---
date: 2023/05/29 12:03:21
title: (论文阅读)Automated WebAssembly Function Purpose Identification With Semantics-Aware Analysis
author: Shaw
categories: Paper
tags: ["WASM"]
---

# Automated WebAssembly Function Purpose Identification With Semantics-Aware Analysis

>**会议：**WWW'23（International World Wide Web Conference，CCF-A）
>
>**作者：**Alan Romano、Weihang Wang（USC）
>
>**时间：**2023.4

# ABSTRACT

​	WebAssembly是最近建立的一个网络标准，用于提高网络应用的性能。该标准定义了一种二进制代码格式，作为各种语言的编译目标，如C、C++和Rust。该标准还定义了一种可读性的文本表示法，不过，WebAssembly模块很难被人类读者解释，无论他们的经验水平如何。这使得理解和维护任何现有的WebAssembly代码变得困难。因此，第三方WebAssembly模块需要被开发者隐含地信任，因为验证功能本身可能是不可行的。

​	为此，我们构建了**WASPur**，一个自动识别WebAssembly函数功能的工具。为了构建这个工具，我们首先构建了一个广泛的WebAssembly样本集，代表了WebAssembly的状态。其次，我们分析数据集，并确定所收集的WebAssembly模块的不同使用情况。我们利用WebAssembly模块的数据集来构建模块中功能的语义感知的中间表示（IR）。我们对函数IR进行编码，用于机器学习分类器，我们发现这个分类器可以预测一个给定函数与已知命名函数的相似性，其准确率为88.07%。我们希望我们的工具能够检查优化和减化的WebAssembly模块，这些模块去除了函数名称和大多数其他语义标识符。



# 知识背景

​	**WebAssembly阅读困难的原因：**

1. WebAssembly只有四种数字数据类型，i32、i64、f32和f64，这使得例如字符串操作和加密散列等操作的指令序列变得十分相似，难以阅读;
2. 其次，它的堆栈机设计使得在某个位置推导出一个变量的值很困难。必须从一个给定的位置追踪堆栈，以确定特定代码位置的计算值。

​	由于许多第三方模块交付时并没有源码，故确定该WASM模块的功能就需要手工验证。有以前的工作研究了WASM样本本身的目的，但是没有工作帮助开发者理解WASM模块的函数功能。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20230526213539080.png" style="zoom: 67%;" />

​	WebAssembly模块有一个明确的结构定义。每个模块由10个部分组成，分别描述模块的不同组成部分：

| Name      | Description                                              |
| --------- | -------------------------------------------------------- |
| Types     | 所有函数参数和返回值类型                                 |
| Functions | 所有WASM函数的类型、使用的局部变量和WASM指令组成的函数体 |
| Tables    | 间接调用目标函数表                                       |
| Memory    | 本模块线性内存部分属性                                   |
| Globals   | 该模块使用的全局变量                                     |
| Elements  | 用于初始化指定函数表的函数索引                           |
| Data      | 用于初始化指定的线性内存部分的字节序列                   |
| Start     | 模块初始化函数                                           |
| Import    | 从JS导入，并在WASM调用的函数                             |
| Exports   | 导出到JS中被调用的函数                                   |

​	本工作的分类方法聚焦于***Functions***节。

## 贡献

1. 我们提出了一个中间表示法（IR）来抽象WebAssembly应用程序的底层语义，以实现语法弹性分析；
2. 构建了从真实网站、火狐插件、Chrome拓展和Github仓库中爬取的WASM样本数据集；
3. 对WASM样本综合分析，将行为目的分为12类；
4. 开发自动分类工具WASPur，以实现WASM函数的自动打标签，准确率达到88.07%。

## 模型方法

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230528195748.png" style="zoom: 67%;" />

### 1. 生成中间表示IR

​	对虚拟栈操作的抽象：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230528202454.png" style="zoom:67%;" />



### 2. 抽象处理

​	首先构建每个函数的内部cfg（iCFG）,再通过call调用连接各个iCFG构建程序间ICFG。为每个函数建立一个单独的ICFG，所需的函数被用作图形遍历的起始点。call的深度被限制为2，其防止了递归函数无限调用。

### 3. 分类器

- **模型：**全连接层神经网络；
- **输入：**抽象序列（每个函数的）；
- **输出：**189个unit（对应人工分析的189个不同function类）

### 4. 数据集 

- **来源：**Alexa、Chrome extensions、Firefox add-ons、GitHub repositories。

- **构建的数据集：**

  - ***Dataset for WebAssembly Binaries***

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230529111145.png" style="zoom:50%;" />

    上表显示了从四个source爬取的：<u>样本总数</u>、<u>使用WASM的样本数</u>、<u>WASM程序数</u>。故这里共有6769个WASM样本，由于一个程序可能有多个WASM模块，这里共有1829个独立模块。

  - ***Dataset for WebAssembly GitHub Repositories***

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230529111746.png" style="zoom:50%;" />

    从112M的Github仓库中定位了435个与WASM有关的仓库，上表表明了这些仓库的功能目的。

- **Module-level 分类**：

  首先将样本分为12类：

  <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230529112849.png" style="zoom:50%;" />

  对于每一类，下表给出其位置、文件大小信息：

  ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230529113357.png)

  下表给出了每个类的特征数和特征例子：

  ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230529114040.png)

- **Function-level 分类**：

  由于WASM在编译时会采用最小化函数名称的机制，会损失很多函数名称信息。这里从至少两个独立模块中出现的函数中创建标签，将类似malloc, _malloc, 和memory.allocate的函数名称压缩为一个单独的标签组malloc。这里得到了189个不同功能的函数类别。

