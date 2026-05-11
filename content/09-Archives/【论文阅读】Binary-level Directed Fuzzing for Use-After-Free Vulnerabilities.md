---
date: 2023/05/25 15:01:42
title: (论文阅读)Binary-level Directed Fuzzing for Use-After-Free Vulnerabilities
author: Shaw
categories: Paper
tags: ["Fuzzing","UAF"]
---

## (论文阅读)Binary-level Directed Fuzzing for Use-After-Free Vulnerabilities

>**时间：**2020
>
>**作者：**Manh-Dung Nguyen（巴黎萨克雷大学CEA）、Sébastien Bardin、Richard Bonichon
>
>**会议：**RAID
>
>**开源：**[1]https://github.com/strongcourage/uafuzz ;[2]https://github.com/strongcourage/uafbench

## ABSTRACT

​	Directed fuzzing聚焦于通过利用额外信息（bug stack trace、补丁或者有风险的操作）来测试代码的特定部分，其重要的应用场景包括漏洞复现、补丁测试以及对静态分析报告的验证。尽管Directed fuzzing最近受到了很多关注，但诸如UAF等难以检测的漏洞仍然没有得到很好的解决，特别是在二进制层面。

​	**<u>我们提出了UAFUZZ，第一个针对UAF漏洞的二进制级别directed greybox fuzzer。</u>**该技术包括了一个针对UAF特性设计的Fuzzer，一个轻量级的代码插装（code instrumentation）工具和一个高效的bug处理步骤。

​	对<u>真实案例中的bug复现进行的实验评估表明</u>，UAFUZZ在故障检测率、暴露时间和bug处理方面明显优于最先进的Directed fuzzer。<u>UAFUZZ在补丁测试中也被证明是有效的</u>，在Perl、GPAC和GNU Patch等程序中发现了30个新的错误（7个CVEs）。最后，我们为社区提供了一个专门用于UAF的大型模糊测试基准，该基准建立在真实代码和真实bug之上。



## 问题背景

>**CGF：** *Coverage-based Greybox Fuzzing*
>
>**DGF：** *Directed Greybox Fuzzing*
>
>**PUT：** *program under test*
>
>**Regression Bug：** *When some bugs are found to be occurring as a result of the bug fix, those are known as regression bugs.*
>
>**Bug stack traces：** sequences of function calls at the time a bug is triggered（KASAN、ASan、VALGRIND）
>
>**Noninterference Bug：**  原本应该隔离的部分发生了影响，例如多线程的静态条件漏洞
>
>**Flaky bug：** 不可靠的bug，其结果难以可靠的复现，其根本原因难以分析

​	Directed fuzzing的应用场景：

- bug reproduction，漏洞复现[25, 28, 42, 61]
- patch testing，补丁测试[25, 51, 59]
- static analysis report verification，静态分析报告验证[31, 49]

### 1. 触发特定漏洞的必要性

​    基于应用场景的不同，在Directed fuzzing中目标位置会被bug stack traces、补丁文件或者静态分析报告所引导。**本文聚焦于漏洞复现**，由于信息缺失和用户隐私问题，通常只有54.9%的错误报告可以被重现，所以特别需要这种方法。即使错误报告中提供了PoC，开发人员在修复的过程中可能仍然需要考虑错误的所有情况，以避免regression bug或不完整的修复。在这种情况下，<u>提供更多的触发错误的输入，对促进和加快bug的修复过程非常重要</u>。

### 2. 目前fuzzer的局限

​	<u>目前的grey box fuzzer（无论是否directed）仍然很难找到复杂的漏洞</u>，例如UAF、Noninterference或flaky漏洞，这些漏洞需要满足非常具体的属性的漏洞触发路径。例如，OSSFUZZ 或最近的grey box fuzzer 只发现了少量的UAF。

### 3. UAF

​	UAF漏洞相比其他类型的漏洞缺乏解决的技术，并且危害十分严重，如数据损坏、信息泄露和Dos攻击。并且要检测UAF还需要面对两个问题：

 1. **状态空间的复杂性：**一个UAF的产生需要经过`分配(alloc)`-`释放(free)`然后`利用(use)`三个顺序过程，在时间和空间上都有限制；

 2. **隐性性状：**UAF漏洞经常没有例如segmentation fault的显性表现，单纯观察崩溃行为的fuzzer就无法发现这种错误。<u>如今流行的内存检测工具：ASan、VALGRIND由于其开销过大不能在fuzzing中使用。</u>

    （ps：如果是仅仅漏洞复现，可以利用其产生的报告信息，参考[[GREBE| shawdox.github.io]](https://shawdox.github.io/2023/04/10/[论文阅读]GREBE-Unveiling-Exploitation-Potential-for-Linux-Kernel-Bugs/)）

​    目前的state-of-the-art：AFLGO和HAWKEYE没法处理UAF并且成本过高。

## 创新点&贡献

​	下表是UAFUZZ与state-of-the-art的比较：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230509225227.png" style="zoom:50%;" />

​	创新点与贡献：**针对UAF的Directed Fuzzing，比state-of-the-art的方法准确率更高，速度更快；开源发布了针对UAF漏洞的测试benchmark，包括了从公开软件中提取的30个真实的Bug**。



## 方法

![Overview of UAFUZZ](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230510123625.png)

### 1. Bug Trace Flattening

​	`Bug Trace Flattening`指重构从report中提取的bug trace，以下图的report为例:

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230510164151.png" style="zoom: 67%;" />

​	将上述report生成的3个call trace合并为一个call tree，并将其按照UAF漏洞的执行顺序（i.e alloc->free->use）的顺序生成分支：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230510164412.png" style="zoom:67%;" />

​	如上图所示，该树状图共有三个分支，分别对应了stack trace for the Alloc、stack trace for the free和stack trace for the bad USE的调用路径。按照0到6的顺序遍历该树，就是UAF漏洞的执行过程，漏洞在6处触发。

​	0 → 1 → 2 → 3(n~alloc~) → 4(n~free~) → 5 → 6(n~use~)

### 2. Seed Selection

#### 2.1 Similarity Metrics

​	s代表某个input，T代表report中的目标UAF bug trace，t(s, T )代表s与T的相似度。这里定义了4个测试标准：

- **Target prefix t~P~(s, T )：**s与T的轨迹覆盖前缀（遇到第一个不同就停止）；
- **UAF prefix t~3TP~(s, T )：**s与T的UAF轨迹覆盖前缀（只关注trace中的UAF事件）；
- **Target bag t~B~(s, T )：**s与T的轨迹覆盖数；
- **UAF bag t~3TB~(s, T )：**s与T的UAF轨迹覆盖数。

​    以下图为例，其需要在buf数组的前三个字节填充“AFU”来触发UAF漏洞，当s='ABUA'时，上述的四个标准值分别为：t~P~(s, T ) = 2，t~3TP~(s, T ) = 1，t~B~(s, T ) = 3，t~3TB~(s, T ) = 2。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230511142942.png" style="zoom:50%;" />

​	将四个metrics结合，得到P-3TP-B：
$$
t_{P-3TP-B} = <t_{P}(s,T),t_{3TP}(s,T),t_{B}(s,T)>
$$
​	上述式子代表，衡量Similarity的标准首先是轨迹前缀覆盖，若其相同则次要考虑UAF轨迹的前缀，最后考虑轨迹的整体覆盖率。这样做兼顾了精度与广度，UAFUZZ的默认种子衡量算法使用P-3TP-B。

#### 2.2 Seed Selection Algorithm

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230510165352.png" alt="Seed Selection Algorithm" style="zoom: 67%;" />

​	如上图所示，种子的选择策略是：要么其与report中的目标bug trace T有着更高的重合度，要么其可以提升代码覆盖率。

#### 2.3 UAF-based Seed Distance

​	AFL使用原始CFG图，图中边的权重都是1；HAWKEYE通过修改边的权重来引导fuzzer。

​	如何引导Fuzzer按某种顺序依次运行？<u>这里定义了三个集合：R~alloc,~ R~free~, 和R~use~，分别表示可以执行alloc、free、use操作的函数集合。根据函数调用关系图来判断，例如，如果fa ∈ R~alloc~并且fb ∈ R ~free~ ∩ R~use~，则从a到b的调用则可能触发UAF漏洞。</u>如下图红色的边。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230511163739.png" style="zoom:50%;" />

​	确定了f~a~->f~b~的调用边，通过减少其边的权重来让fuzzer更容易执行它，在本工作的实验中，使用如下权重（β=0.25）：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230511163709.png" style="zoom:50%;" />

#### 2.4 Cut-edge Coverage Metric

​	<u>由于对基本块插装的成本过高，HAWKEYE使用对函数插装的方式来跟踪某个种子的运行轨迹（function level）。</u>

​	本工作提出cut-edge coverage metric，在**edge level**上衡量**关键节点**的程序运行轨迹，该方法是basic block level和function level的平衡。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230525104634.png" style="zoom: 67%;" />

 ps：

- cut-edge：两个basic block（source和sink）之间的cut edge就是存在一条通过这条edge的路径，可以从source到达sink；

- algorithm：算法3、4说明了如何在函数间/函数内部计算识别cut edge；
- 想法：遍历更多cut-edge，更少non-cut edge更容易达到目标轨迹。



#### 2.5 Power Schedule

​	Power Schedule结合了上述三种方法（**target similarity metric t~P~(s, T )**、**UAF-based seed distance d(s, T )**和**cut-edge coverage metric e~s~(s, T )**）。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230525110851.png" style="zoom:50%;" />

​	

#### 2.6 Postprocess and Bug Triage

​	UAF漏洞发生时一般并不会伴随显式的崩溃，故要检测某个种子是否触发了UAF，需要将其送入bug triager中（例如VALGRIND）检测。因此，当fuzzer生成了大量的种子时，这么做成本很高。

​	但由于本工作的**target similarity metric**可以检测种子的指令路径是否包含了三个UAF关键事件，故bug triager只需要检测包含这些事件的种子即可。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230525145138.png" style="zoom:50%;" />

​	代码实现基于AFL和QEMU。



## 测试结果

>baseline：AFL-QEMU
>
>compare：AFLGO、HAWKEYE
>
>benchmark：自行构建



## REFERENCE