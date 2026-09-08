---
title: ArrayList源码解析
description: 从动态数组的底层结构、构造函数懒加载、1.5 倍扩容到 fail-fast 迭代器，每个知识点对应源码片段逐段拆解。
pubDate: 2026-09-08
category: 技术博客
tags: [Java, ArrayList, 集合]
mood: "沉淀中"
---

ArrayList 是 Java 集合框架中最常用的 List 实现，底层是一个**动态数组**，可以自动扩容。这篇文章把每个知识点和对应源码放在一起，逐段拆解。

## 一、底层结构：动态数组

```java
// 保存ArrayList数据的数组
transient Object[] elementData; // non-private to simplify nested class access

// ArrayList 所包含的元素个数
private int size;

// 默认初始容量大小
private static final int DEFAULT_CAPACITY = 10;

// 空数组（用于空实例）。
private static final Object[] EMPTY_ELEMENTDATA = {};

// 用于默认大小空实例的共享空数组实例。
// 我们把它从EMPTY_ELEMENTDATA数组中区分出来，以知道在添加第一个元素时容量需要增加多少。
private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};
```

三个关键点：

- `elementData` 是真正存数据的数组，`size` 是逻辑元素个数，注意 **`size` 不等于 `elementData.length`**（容量）
- 两个空数组常量长得一样，但用途完全不同：`EMPTY_ELEMENTDATA` 是"我明确指定容量为 0"，`DEFAULTCAPACITY_EMPTY_ELEMENTDATA` 是"我用无参构造、还没加过元素"。区分它们是为了知道**第一次 add 时该扩容到多大**（后面 `calculateCapacity` 会用到）
- `transient` 修饰 elementData：序列化时跳过它，用自定义的 `writeObject` 只序列化有元素的部分，省空间

## 二、三个构造函数与懒加载

```java
// 无参构造：懒加载，先指向共享空数组，第一次 add 时才真正分配容量
public ArrayList() {
    this.elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA;
}

// 指定初始容量
public ArrayList(int initialCapacity) {
    if (initialCapacity > 0) {
        this.elementData = new Object[initialCapacity]; // 直接分配
    } else if (initialCapacity == 0) {
        this.elementData = EMPTY_ELEMENTDATA;           // 等于 0，用空数组
    } else {
        throw new IllegalArgumentException("Illegal Capacity: " + initialCapacity); // 负数抛异常
    }
}
```

- 无参构造是**懒加载**：`new ArrayList<>()` 只占用一个空数组引用（4/8 字节），等第一次 `add()` 才扩容到 10。创建一个没用起来的 ArrayList 几乎零成本
- 指定容量构造：>0 直接分配，=0 走空数组，<0 抛 `IllegalArgumentException`

## 三、扩容机制：为什么是 1.5 倍

扩容链路：`add()` → `ensureCapacityInternal()` → `ensureExplicitCapacity()` → `grow()`。

```java
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // Increments modCount!!
    elementData[size++] = e;           // 数组赋值，这就是 add 的实质
    return true;
}

// 第一次 add 时，把默认容量 10 和 minCapacity 取较大值
private static int calculateCapacity(Object[] elementData, int minCapacity) {
    if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        return Math.max(DEFAULT_CAPACITY, minCapacity);
    }
    return minCapacity;
}

// 判断是否需要扩容：只有 minCapacity 超过数组长度才走 grow
private void ensureExplicitCapacity(int minCapacity) {
    modCount++;
    if (minCapacity - elementData.length > 0)
        grow(minCapacity);
}

// 扩容核心：新容量 = 旧容量 + 旧容量 >> 1，即 1.5 倍
private void grow(int minCapacity) {
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1); // 位运算代替除法，更快
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;                      // 1.5 倍不够就取最小需要容量
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);        // 大数组走特殊分支
    elementData = Arrays.copyOf(elementData, newCapacity); // 真正扩容：复制到新数组
}
```

- **为什么是 1.5 倍而不是固定加 10 或 2 倍**：固定增量会导致频繁扩容（每次都要 `Arrays.copyOf` 全量拷贝，O(n)）；2 倍空间浪费更多。1.5 倍是"扩容次数"和"空间浪费"之间的折中，扩容的**摊还复杂度是 O(1)**——虽然单次扩容是 O(n)，但 n 次 add 总共只拷贝 O(n) 次元素，平均每次 add O(1)
- `oldCapacity >> 1` 是右移一位，等价于除以 2，位运算比除法快
- 扩容上限：`MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8`（留 8 字节给对象头），超过再走 `hugeCapacity` 判断溢出

## 四、增删查改的时间代价

**尾部 add：摊还 O(1)**（上面已看，数组赋值）

**中间插入 / 删除：O(n)**，因为要整体搬移元素：

```java
public void add(int index, E element) {
    rangeCheckForAdd(index);
    ensureCapacityInternal(size + 1);  // Increments modCount!!
    // 把 index 及之后的元素整体后移一位
    System.arraycopy(elementData, index, elementData, index + 1, size - index);
    elementData[index] = element;
    size++;
}

public E remove(int index) {
    rangeCheck(index);
    modCount++;
    E oldValue = elementData(index);
    int numMoved = size - index - 1;
    if (numMoved > 0)
        System.arraycopy(elementData, index + 1, elementData, index, numMoved); // 整体前移
    elementData[--size] = null; // clear to let GC do its work
    return oldValue;
}
```

**按下标查改：O(1)**：

```java
public E get(int index) {
    rangeCheck(index);
    return elementData(index);  // 就是一次数组下标访问
}
```

`System.arraycopy` 是 native 方法，搬移效率高，但仍然是 O(n) 的拷贝量。所以**中间插入/删除频繁的场景，ArrayList 不合适**。

## 五、fail-fast 机制

ArrayList 是线程不安全的。迭代器遍历时，如果别的线程（或同线程的 `list.remove()`）修改了结构，继续迭代会立即抛 `ConcurrentModificationException`：

```java
public Iterator<E> iterator() {
    return new Itr();
}
```

`Itr` 内部维护了一个 `expectedModCount`，每次 `next()` 先检查：

```java
// Itr.next() 内部（JDK 源码）
public E next() {
    checkForComodification();   // 每次取元素前先检查
    int i = cursor;
    ...
}

final void checkForComodification() {
    if (modCount != expectedModCount)   // 结构被改过，计数不一致
        throw new ConcurrentModificationException();
}
```

- `modCount` 是"结构性修改"的计数器，`add/remove/clear` 都会 `modCount++`（前面源码里能看到）
- 迭代器创建时记住 `expectedModCount = modCount`，遍历中发现对不上就抛异常——这就是 **fail-fast（快速失败）**，宁可报错也不返回脏数据
- 所以**迭代过程中要删除元素，必须用 `iterator.remove()`**（它会同步更新 `expectedModCount`），而不是 `list.remove()`

## 六、和 LinkedList 怎么选

| 操作 | ArrayList | LinkedList |
|---|---|---|
| 按下标查改 | **O(1)**，数组直接访问 | O(n)，要遍历找节点 |
| 尾部增删 | **O(1) 摊还**（扩容摊销） | O(1) |
| 中间增删 | O(n)，`arraycopy` 搬移 | O(n)，但要先遍历定位，且每次分配节点 |
| 内存 | 连续数组，省内存、缓存友好 | 每个节点多存前后指针，占内存 |

**一句话结论**：绝大多数场景用 ArrayList——查得快、缓存友好、内存紧凑。LinkedList 只有在"已知要频繁在头部/中间操作且持有迭代器"时才值得考虑，日常几乎用不到。
