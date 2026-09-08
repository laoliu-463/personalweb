---
title: HashMap vs ConcurrentHashMap：源码级核心差异对比
description: 从哈希计算、初始化、put 流程、扩容、计数、get、树化到 null 处理，逐模块对比 HashMap 与 ConcurrentHashMap 的源码级差异。
pubDate: 2026-09-08
category: 技术博客
tags: [Java, HashMap, ConcurrentHashMap, 并发]
mood: "沉淀中"
---

下面从源码层面，逐模块对比 HashMap 和 ConcurrentHashMap 的核心差异：

## 一、哈希计算

| 维度 | HashMap | ConcurrentHashMap |
|---|---|---|
| 方法名 | `hash()` | `spread()` |
| 实现 | `(h = key.hashCode()) ^ (h >>> 16)` | `(h ^ (h >>> 16)) & HASH_BITS` |
| 区别 | 不处理符号位 | `& HASH_BITS` 确保结果一定是正数 |

**为什么要保证正数？** 因为 ConcurrentHashMap 用负数的 hash 值来标记特殊节点（MOVED = -1、TREEBIN = -2），如果普通节点的 hash 也可能是负数，就无法区分了。

## 二、初始化

**HashMap：简单粗暴**

```java
// 无参构造时 table 为 null，不分配数组
// 首次 put 时，在 resize() 中初始化
if (oldCap == 0) {
    newCap = DEFAULT_INITIAL_CAPACITY; // 16
}
```

**ConcurrentHashMap：CAS 竞争**

```java
private final Node<K,V>[] initTable() {
    while ((tab = table) == null || tab.length == 0) {
        if ((sc = sizeCtl) < 0)
            Thread.yield(); // 有其他线程在初始化，让出 CPU
        else if (U.compareAndSwapInt(this, SIZECTL, sc, -1)) { // CAS 竞争
            // 只有 CAS 成功的线程才能执行初始化
            tab = new Node[n];
            table = tab;
            sizeCtl = n - (n >>> 2); // 设为阈值
        }
    }
}
```

**核心差异**：HashMap 不需要考虑并发，直接初始化即可。ConcurrentHashMap 必须用 CAS 保证只有一个线程能执行初始化，其他线程等待。

## 三、put 流程（最大差异）

**HashMap：无锁，直接操作**

```java
final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    // 1. 计算桶位置
    int i = (n - 1) & hash;

    // 2. 桶为空 → 直接放入
    if (tab[i] == null)
        tab[i] = newNode(hash, key, value, null);

    // 3. 桶不为空 → 遍历链表/红黑树，找到则覆盖，找不到则尾插
    else {
        // 遍历...
    }

    // 4. 检查扩容
    if (++size > threshold)
        resize();
}
```

特点：全程没有任何锁，单线程直接操作数组。

**ConcurrentHashMap：CAS + synchronized 三级分流**

```java
final V putVal(K key, V value, boolean onlyIfAbsent) {
    // 1. 桶为空 → CAS 无锁插入
    if (tabAt(tab, i) == null)
        casTabAt(tab, i, null, new Node<>(hash, key, value, null));

    // 2. 正在扩容 → 帮忙迁移
    else if (f.hash == MOVED)
        tab = helpTransfer(tab, f);

    // 3. 桶不为空 → synchronized 锁住头节点后操作
    else {
        synchronized (f) { // 只锁这一个桶
            // 链表或红黑树的插入逻辑
        }
    }

    // 4. 检查扩容
    addCount(1L, binCount); // binCount 是链表遍历计数，用来判断是否需要扩容
}
```

**核心差异对比：**

| 场景 | HashMap | ConcurrentHashMap |
|---|---|---|
| 桶为空 | 直接赋值 | CAS 无锁插入 |
| 桶不为空 | 直接遍历操作 | synchronized(f) 锁住头节点 |
| 正在扩容 | 不存在此场景 | 调用 helpTransfer 帮忙迁移 |
| 锁的粒度 | 无锁 | 单个桶级别 |

## 四、扩容机制

**HashMap：单线程扩容**

```java
final Node<K,V>[] resize() {
    Node<K,V>[] newTab = new Node[newCap];
    table = newTab;

    // 单线程遍历旧数组，逐个迁移元素
    for (int j = 0; j < oldCap; j++) {
        Node<K,V> e;
        if ((e = oldTab[j]) != null) {
            // 迁移逻辑...
        }
    }
}
```

问题：HashMap 全程无锁，并发 put 属于数据竞争、线程不安全（JDK 1.7 并发扩容甚至会导致链表成环死循环）。

**ConcurrentHashMap：多线程协助迁移**

```java
private final void transfer(Node<K,V>[] tab, Node<K,V>[] nextTab) {
    // 1. 用 ForwardingNode 占位，标记已迁移的桶
    setTabAt(nextTab, i, new ForwardingNode<K,V>(nextTab));

    // 2. 从后往前遍历，每个线程认领一段桶（stride 个）
    // 3. 其他线程 put 时遇到 ForwardingNode，会调用 helpTransfer 帮忙迁移
    // 4. 所有桶迁移完成后，替换 table 引用
}
```

**核心差异：**

| 维度 | HashMap | ConcurrentHashMap |
|---|---|---|
| 迁移方式 | 单线程一次性迁移 | 多线程并行迁移 |
| 扩容期间能否读写 | 读可以，写是数据竞争 | 读写都不阻塞 |
| 标记方式 | 无 | ForwardingNode 占位 |
| 线程协作 | 无 | 其他线程遇到 ForwardingNode 主动帮忙 |

## 五、计数机制

**HashMap：直接 size++**

```java
++size; // 单线程环境，直接自增即可
```

**ConcurrentHashMap：分散计数（LongAdder 思想）**

```java
private final void addCount(long x, int check) {
    // 低竞争：CAS 更新 baseCount
    if (U.compareAndSwapLong(this, BASECOUNT, b = baseCount, b + x)) {
        // ...
    }
    // 高竞争：分散到 CounterCell 数组的多个槽位
    else {
        // 每个线程更新不同的 Cell，最后求和
    }
}
```

**为什么要这么复杂？** 如果用 AtomicInteger，高并发下所有线程 CAS 竞争同一个值，大量线程会自旋失败。分散计数让不同线程更新不同的槽位，大幅减少竞争。

## 六、get 操作

**HashMap**

```java
public V get(Object key) {
    Node<K,V> e = getNode(hash(key), key);
    // 直接读，无需任何特殊处理
}
```

**ConcurrentHashMap**

```java
public V get(Object key) {
    // 1. 正常查找
    // 2. 如果节点的 hash 是负数（eh < 0），说明是特殊节点，走各自的 find 方法：
    //    - ForwardingNode（正在扩容）→ 去新数组中查找
    //    - TreeBin（红黑树）→ 走红黑树查找
    else if (eh < 0)
        return (p = e.find(h, key)) != null ? p.val : null;
}
```

差异：ConcurrentHashMap 的 get 需要额外处理特殊节点——如果读到的桶是 ForwardingNode，说明该桶已经迁移到新数组了，需要去新数组中查找。

## 七、树化机制

两者的树化阈值相同（链表 ≥ 8 且容量 ≥ 64），但触发方式不同：

**HashMap**

```java
if (binCount >= TREEIFY_THRESHOLD) // 直接树化
    treeifyBin(tab, i);
```

**ConcurrentHashMap**

```java
if (binCount >= TREEIFY_THRESHOLD)
    treeifyBin(tab, i); // 内部也会判断容量是否 >= 64
```

逻辑基本一致，但 ConcurrentHashMap 的 treeifyBin 内部需要加锁（synchronized），保证树化操作的线程安全。

## 八、null 处理

**HashMap：允许 null**

```java
// JDK8 中 hash() 对 null key 返回 0
// null key 因此固定定位到桶 [0]
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

**ConcurrentHashMap：禁止 null**

```java
final V putVal(K key, V value, boolean onlyIfAbsent) {
    if (key == null || value == null)
        throw new NullPointerException(); // 直接抛异常
}
```

**为什么？** 多线程环境下，get 返回 null 无法区分"key 不存在"和"value 是 null"，会引发歧义。

## 📌 总结：一张表看清所有差异

| 维度 | HashMap | ConcurrentHashMap |
|---|---|---|
| 哈希函数 | hash()，结果可能为负 | spread()，结果一定为正 |
| 初始化 | 直接创建 | CAS 竞争，保证只有一个线程初始化 |
| 桶为空时插入 | 直接赋值 | CAS 无锁插入 |
| 桶不为空时插入 | 直接操作 | synchronized 锁住头节点 |
| 扩容 | 单线程迁移 | 多线程协助迁移 + ForwardingNode 占位 |
| 计数 | size++ | baseCount + CounterCell 分散计数 |
| get 扩容处理 | 无 | 遇到 ForwardingNode 去新数组找 |
| null | 允许 null key/value | 禁止 null key/value |
| 锁 | 无 | CAS + synchronized（桶级别） |
