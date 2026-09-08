---
title: HashMap源码解析
description: HashMap 的底层结构、hash 扰动函数、put 流程、树化条件与 resize 扩容，知识点对应 JDK8 源码逐段拆解。
pubDate: 2026-09-08
category: 技术博客
tags: [Java, HashMap, 集合]
mood: "沉淀中"
---

HashMap 是 Java 里最常用的键值对容器，底层是哈希表。JDK1.8 之前是**数组 + 链表**，1.8 之后是**数组 + 链表 + 红黑树**。这篇文章把每个知识点和对应源码放在一起拆解。

## 一、底层结构与关键常量

```java
// 默认初始容量：16（必须是 2 的幂）
static final int DEFAULT_INITIAL_CAPACITY = 1 << 4; // 16

// 负载因子：0.75
static final float DEFAULT_LOAD_FACTOR = 0.75f;

// 树化阈值：链表长度到 8
static final int TREEIFY_THRESHOLD = 8;

// 反树化阈值：红黑树节点数降到 6 退回链表
static final int UNTREEIFY_THRESHOLD = 6;

// 最小树化容量：数组长度至少 64 才允许树化
static final int MIN_TREEIFY_CAPACITY = 64;

// 真正存数据的桶数组
transient Node<K,V>[] table;
```

- 容量必须是 **2 的幂**（默认 16），这是后面 `(n-1) & hash` 定位和扩容 rehash 能高效成立的前提
- **负载因子 0.75**：容量 × 负载因子 = 扩容阈值（16 × 0.75 = 12），元素数超过阈值就扩容。0.75 是时间（减少哈希冲突）和空间（少浪费数组）的折中

## 二、hash 扰动函数

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

- key 为 null 也能存（hash 为 0，落到 0 号桶）
- `h >>> 16` 把高 16 位搬到低 16 位，再和原 hash **异或**，让高 16 位也参与后续的取模运算——因为桶索引只用低 n 位（`(n-1) & hash`），如果 key 的 hashCode 低位都一样，异或能**打散低位的分布，减少冲突概率**

## 三、核心 put 流程

```java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    // 1. 首次 put：懒加载，调用 resize() 初始化数组
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;
    // 2. 通过 (n-1) & hash 计算桶索引
    // 3. 桶为空，直接插入新节点
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    else {
        // 4. 桶不为空，分三种情况：
        //    a. 头结点 key 相同 → 新值覆盖旧值
        //    b. 桶已经是红黑树 → 调用红黑树方法插入节点
        //    c. 桶是链表 → 尾插法遍历，有相同 key 覆盖，否则插到尾部
        Node<K,V> e; K k;
        if (p.hash == hash && ((k = p.key) == key || (key != null && key.equals(k))))
            e = p;                                    // 情况 a：key 相同
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value); // 情况 b：红黑树
        else {
            for (int binCount = 0; ; ++binCount) {    // 情况 c：链表尾插
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null);
                    if (binCount >= TREEIFY_THRESHOLD - 1) // 链表长度达到 8，尝试树化
                        treeifyBin(tab, hash);
                    break;
                }
                if (e.hash == hash && ((k = e.key) == key || (key != null && key.equals(k))))
                    break;                            // 遍历到相同 key，覆盖
                p = e;
            }
        }
        // 5. key 已存在：新值覆盖旧值，返回旧值
        if (e != null) {
            V oldValue = e.value;
            e.value = value;
            return oldValue;
        }
    }
    ++modCount;
    // 6. 插入后元素数超过阈值，扩容
    if (++size > threshold)
        resize();
    return null;
}
```

完整链路：**resize() 懒加载 → hash 扰动 → (n-1)&hash 定位桶 → 空桶直插 / 同 key 覆盖 / 红黑树插入 / 链表尾插 → 超过阈值 resize()**。和你的笔记完全一致，JDK8 采用**尾插法**（JDK7 是头插法，并发扩容时可能形成环形链表，这也是 1.8 改尾插的原因之一）。

## 四、树化条件：为什么 >8 且 >64

```java
final void treeifyBin(Node<K,V>[] tab, int hash) {
    int n, index; Node<K,V> e;
    // 数组长度 < 64：先扩容，不树化
    if (tab == null || (n = tab.length) < MIN_TREEIFY_CAPACITY)
        resize();
    else if ((e = tab[index = (n - 1) & hash]) != null) {
        // 数组长度 >= 64，才真正把链表转成红黑树
        ...
    }
}
```

- 链表长度到 8 只是"触发尝试"，**数组长度必须 ≥ 64 才真正树化**；不足 64 时先扩容（扩容本身会让链表变短）
- 为什么阈值是 8：理想情况下 hash 均匀分布，同一个桶里链表长度超过 8 的概率约千万分之一（泊松分布），达到这个值说明 hash 分布已经很不均匀，此时牺牲一点插入性能换红黑树的 **O(log n) 查找**是值得的；而红黑树节点比链表节点大（多了 4 个引用），所以平时宁可用链表

## 五、resize 扩容机制

```java
final Node<K,V>[] resize() {
    ...
    // 容量翻倍：newCap = oldCap << 1（保持 2 的幂）
    int newCap = oldCap << 1;
    ...
    // 重新分布元素：hash & oldCap == 0 留在原索引，否则移到 原索引 + oldCap
    if ((e.hash & oldCap) == 0) {
        // 留在原桶
    } else {
        // 移到 (原索引 + oldCap) 的新桶
    }
}
```

- 扩容到**原来的 2 倍**，保持容量是 2 的幂
- rehash 不需要重新计算全部 hash：因为桶索引是 `(n-1) & hash`，容量翻倍只多了一位，**新增的那一位是 0 就留在原位，是 1 就移动到「原索引 + oldCap」**——一次位运算即可判断，这也是容量必须为 2 的幂的核心原因
- 扩容整体是 O(n) 的（要复制所有节点），所以预估元素数量时给足初始容量能避免频繁扩容

## 六、小结

HashMap 的设计核心一句话：**用空间换时间，用位运算换除法，用概率换复杂度**——2 的幂容量让取模变成位运算、让扩容 rehash 变成一次位判断；0.75 负载因子和 8/64 阈值都是统计意义上的最优折中。
