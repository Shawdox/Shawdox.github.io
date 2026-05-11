---
date: 2023/07/22 21:47:37
title: (论文阅读)RULF-Rust Library Fuzzing via API Dependency Graph Traversal
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# RULF: Rust Library Fuzzing via API Dependency Graph Traversal

>**时间：**2021
>
>**作者：**Jianfeng Jiang、Hui Xu、Yangfan Zhou（复旦大学）
>
>**会议：**ASE
>
>**开源：**https://github.com/Artisan-Lab/RULF

## Abstract

​	鲁棒性是 Rust 库开发的一个关键问题，因为 Rust 承诺，如果开发人员只使用安全的 API，就不会出现未定义行为的风险。Fuzzing是检查程序鲁棒性的一种实用方法，然而，由于缺乏目标，现有的fuzzing工具并不能直接适用于library API。故这项工作主要依靠人工逐个设计fuzzing target，耗费大量人力物力。

​	为了解决这个问题，本文提出了一种新颖的自动fuzzing目标生成方法，<u>通过遍历 API 依赖图</u>来fuzzing Rust 库。我们确定了library fuzzing的几个基本要求，包括target的有效性、高 API 覆盖率和fuzzing的效率。为了满足这些要求，我们首先采用了带有剪枝功能的广度优先搜索，以找到长度低于阈值的 API 序列，然后反向搜索更长的序列以查找未覆盖的 API，最后将序列集作为集合覆盖问题进行优化。

​	我们实现了fuzz target生成器，并使用 AFL++ 在多个现实世界中流行的 Rust 项目上进行了fuzzing实验。我们的工具最终为每个库生成了 7 到 118 个fuzzing target，API 覆盖率高达 0.92。我们以 24 小时为阈值对每个目标进行测试，并从七个库中发现了 30 个以前未知的错误。



## Background

​	本文旨在<u>弥补 Rust 库fuzzing与现有fuzzing工具之间的差距</u>，Rust 库fuzzing面临的一个主要问题是缺乏模糊目标。

​	Fuzz target代表着一个字节数组，作为执行由某些库 API 组成的程序的输入[14]，fuzzer可以更改fuzz target的输入，以探索不同的路径。现有的fuzzing工具，如 AFL [15]、honggfuzz [16] 和 libFuzzer [17]，都需要fuzz target来对目标库进行fuzzing测试，而编写fuzz target主要依靠人力。

- **Fudge [18] （**FSE/ESEC'2019）是最近提出的一种用于 C/C++ 程序的fuzz target生成器，它从谷歌代码库中提取代码片段，然而，它的有效性在很大程度上取决于库的使用情况，并且存在很大的局限性。例如，它不适用于新发布的库或 API；或者它无法为未使用的 API 生成模糊目标，但错误可能与很少使用的功能有关；
- **FuzzGen [31]**（USENIX Security'2020）从系统中已有使用库的代码出发，通过对整个系统进行分析，整理出抽象API依赖图(A2DG)，并基于依赖图生成libFuzzer的桩代码，从而进行不需人工干预、能较好地平衡宽度和深度的fuzz;



## Contirbution

​	本文研究了一种自动fuzzing target生成方法，我们的方法追求四个目标：Validity，即程序应能成功编译；effectiveness，即模糊目标应便于模糊工具实现高代码覆盖率或错误查找；覆盖率和效率，即模糊目标应覆盖尽可能多的应用程序接口，其集合应尽可能小。

​	为确保validity，我们根据给定库的 API 依赖关系图来组成fuzzing target。由于每个fuzzing target都可以看作是 API 调用的一个序列，<u>**因此我们会在API依赖图的长度阈值下对 API 序列进行广度优先搜索（BFS）**</u>。对于由于长度限制而未被发现的 API（深层 API），我们会反向搜索其依赖的 API 序列。最后，我们对序列集进行细化，以获得涵盖相同 API 集的最小子集。

​	我们实现了一个fuzzing target生成器RULF。根据 Rust 库的 API 规范，它可以生成一组fuzzing target，并与 AFL++ [19] 无缝集成，用于模糊测试。我们对 14 个流行的 Rust 库进行了实验，其中包括三个来自 GitHub 的库和 11 个来自 crates 的库。由于 BFS 的深度约束为 3，我们为每个库生成了 7-118 个模糊目标，此外，我们以 24 小时的预算对每个目标进行模糊测试，在七个库中发现了 30 个以前未知的错误。

- 为 Rust 库自动生成fuzzing target的试点研究。它扩展了现有fuzzing技术的适用性，而考虑到 Rust 对未定义行为的不容忍，这种扩展正是 Rust 所迫切需要的;
- 我们提出的方法利用了一种复杂的遍历算法，只需少量浅层fuzzing target即可实现较高的 API 覆盖率。这种方法被证明是有效和高效的。它可以为进一步研究代码遍历提供启示；
- 我们为 Rust 库实现了一个开源的fuzzing target生成器RULF，利用该工具，我们成功地在 7 个流行的 Rust 库中发现了 30 个以前未知的漏洞。

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230723134820.png)

## Reference

- [【论文总结】Fuzz Driver Generation - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/629837208)

  