---
date: 2023/06/20 19:16:32
title: (论文阅读) Concolic Execution for WebAssembly
author: Shaw
categories: Paper
tags: ["WASM" , "Symbolic Execution" ]
---

# Concolic Execution for WebAssembly

>时间：2022
>
>作者：Filipe Marques、José Fragoso Santos、Nuno Santos（里斯本大学）
>
>会议：ECOOP’2022（软工CCF-B）

## Abstract

​	WebAssembly（Wasm）是一种新的二进制指令格式，允许用高级语言编写的目标编译代码以接近原生的速度被浏览器的JavaScript引擎执行。<u>尽管Wasm有明显的性能优势，但它为网络程序引入错误或安全漏洞提供了机会，因为用不安全语言编写的程序中已有的问题可以转移到交叉编译的二进制文件中。</u>这种二进制文件的源代码经常无法用于静态分析，这就需要有能够直接处理Wasm代码的工具。尽管这种潜在的安全关键情况，仍然明显缺乏分析Wasm二进制文件的工具支持。

​	我们提出了WASP，一个用于测试Wasm模块的符号执行引擎，它直接在Wasm代码上工作，并建立在一个符合标准的Wasm参考实现之上。我们对WASP进行了全面的评估：它被用来符号执行测试C语言的通用数据结构库和C语言的亚马逊加密SDK，证明它可以为真实世界的C语言应用找到错误并产生高覆盖率的测试输入；并进一步针对Test-Comp基准进行测试，获得了与成熟的C语言符号执行和测试工具相当的结果。



## 问题背景

### 1. Concolic execution

​	Concolic execution是符号执行的一种特殊变体，在这种情况下，人们将具体的执行与纯粹的符号执行配对，通过一次探索一个执行路径来避免与底层SMT求解器的交互。<u>Concolic执行引擎为符号输入分配具体数值，并同时以具体和符号方式执行给定的程序，只遵循具体路径，但像纯符号执行那样构建与该路径对应的路径条件。</u>

​	更具体地说，它可以用来为符号变量生成新的具体输入，从而强制探索不同的路径。为此，人们需要否定上一次执行获得的路径条件，并查询底层求解器，以获得公式的模型。<u>通过跟踪所有通过Concolic执行产生的路径条件，引擎可以列举出所有的程序执行路径，直到一个边界，其优点是每个探索的路径只需要与底层求解器交互一次。**请注意，在纯粹的符号执行中，引擎必须在每次遇到分支点时查询求解器，以确定其then-和else-分支是否可行。**</u>

​	以如下代码为例(*参考《Robust Symbolic Execution for WebAssembly》*)：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230620193746.png" style="zoom:50%;" />

​	**目标：测试assert语句成立的条件。**

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230620210915.png" style="zoom:50%;" />

​	如上图所示，程序有三条可能的执行路径，对于每一个执行路径（execution path），我们称其为一个***concolic iteration***。

​	在Concolic execution中：

 1. 第一个concolic iteration开始前，变量x与y被赋予具值0与2，这些输入导致Concolic execution引擎探索上图最右边的路径，产生最后的路径条件：**X≤0**；

 2. 第二个concolic iteration开始前，Concolic execution引擎查询底层SMT求解器，为符号输入寻找一个满足公式**x>0**的输入值，即对应于第一个路径条件的否定。让我们假设求解器返回x=1和y=0。这些输入导致引擎探索中间的执行路径，产生路径条件：**（x>0）∧（x≥y）**；

 3. 第三个concolic iteration开始前，同2，引擎继续利用SMT求解器查找对2生成条件的否定，得到：(x > 0) ∧ ((x ≤ 0) ∨ (x < y))，也就是等价于：**(x > 0) ∧ (x < y)**。假设这里得到了具体输入x=1和y=2，程序探索了最左边的执行路径，**<u>但此时这个输入并没有触发断言，其导致a=4，b=6</u>**。当这条路径执行到断言语句时，条件为：

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230620195227.png" style="zoom:50%;" />

    符号执行引擎会继续对这个条件做分析，即在满足PC条件（x>0 and x<y）下，是否可以推出：

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230620195505.png" style="zoom:50%;" />

    即是否存在反例：

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230620195611.png" style="zoom:50%;" />

    SMT求解这个式子很容易得出，x=1,y=4，故这条路径上存在导致断言失败的输入。

    

### 2. 现有WASM符号执行工具

​	据我们所知，目前只有两个工具用于象征性地执行Wasm代码： WANA[73]和Manticore[51]。然而，这两个工具主要是针对智能合约的分析，并有重要的限制，限制了它们对独立的Wasm模块的应用。<u>WANA[73]处于初步开发阶段，只能应用于EOSIO和Ethereum智能合约，因为它不包括可以独立运行的Wasm的符号执行引擎。</u><u>Manticore[51]最近获得了对Wasm[33]的支持，但尚未对Wasm代码进行系统的评估。此外，它对Wasm模块的应用需要为每个可能的输入内存手动设置一个复杂的Python脚本，这使得它很麻烦，难以实现自动化。</u>

​	 

## 贡献

​	我们提出了WebAssembly符号处理器，WASP，一个用于测试Wasm（1.0版）模块的新型Concolic execution引擎。WASP遵循所谓的Concolic discipline[28, 64]，将具体执行与符号执行相结合，一次探索一条执行路径。**<u>然而，与大多数通过对程序插桩的Concolic execution引擎[65, 79, 64, 63]不同，我们通过对Haas等人[30]开发的Wasm解释器的插桩实现WASP。</u>**为此，我们将作者的参考解释器从具体数值提升到具体数值和符号数值对。通过将插桩转移到解释器层面，我们为Concolic execution中的一系列优化提供了可能性。

	1. WASP能够分析独立的Wasm模块（不同于WANA），它能够被用作一个通用的平台，为编译成Wasm的高级编程语言建立符号分析；
	2. WASP能够分析大多数C语言库；



## 模型

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230620210942.png)