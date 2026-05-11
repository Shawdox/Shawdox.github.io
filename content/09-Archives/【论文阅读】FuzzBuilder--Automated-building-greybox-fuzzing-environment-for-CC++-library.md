---
date: 2023/07/23 14:07:38
title: (论文阅读)FuzzBuilder- Automated building greybox fuzzing environment for C/C++ library
author: Shaw
categories: Paper
tags: ["Fuzzing"]
---

# FuzzBuilder: Automated building greybox fuzzing environment for C/C++ library

>**时间：**2019
>
>**作者：**Joonun Jang、Huy Kang Kim（三星研究院、首尔大学）
>
>**会议：**ACSAC
>
>**开源：**https://github.com/hksecurity/FuzzBuilder

## Abstract

​	Fuzzing是发现软件漏洞的一种有效方法，由于fuzzing发现的大多数错误都与安全漏洞有关，因此许多安全社区都对模糊测试这种验证软件安全性的自动化方法很感兴趣。然而，并非所有软件都能通过模糊测试进行测试，因为模糊测试需要运行环境，特别是可执行文件，值得注意的是，就库而言，大多数库实际上都没有相关的可执行文件。

​	因此，最先进的fuzzer在测试任意库方面存在局限性，为了克服这个问题，我们提出了 FuzzBuilder，为库提供自动fuzzing environment。FuzzBuilder生成的可执行文件会调用库的 API 函数，从而实现库模糊测试，此外，FuzzBuilder 生成的任何可执行文件都与 AFL 等现有模糊器兼容。

​	我们通过测试开源库来评估 FuzzBuilder 的整体性能。因此，我们在实现高代码覆盖率的同时发现了库中的未知错误。我们相信，FuzzBuilder 可以帮助安全研究人员节省库模糊测试的设置成本和学习成本。



## Background

​	编写库fuzzing代码时，首先要选择一个基本函数。此外，还需要调用与基础函数相关的其他函数，以实现足够的代码覆盖率。例如，库中特定功能的实现可分为一个或多个函数。此外，如果函数需要其他函数的返回值，则不能单独测试库中的特定函数，在这种情况下，应联合测试所有相关函数。因此，**在编写库fuzzing代码时，应考虑调用函数序列而不是单个函数**。Han 等人[18]在他们的内核模糊器中引入了类似的 API 模型概念，其中包括两类依赖关系：排序依赖关系和值依赖关系。	

​	本文将函数序列定义为一组需要联合测试的函数。图 2 显示了编写库模糊测试代码需要函数序列的原因:

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230723143028.png" style="zoom:50%;" />

​	依次调用init - insert - parse_A, and init - insert - parse_B可以获得最高的覆盖率。、

​	因此，我们提出了一种<u>通过使用单元测试中准备好的函数序列和测试输入来生成可执行文件和种子的方法</u>。虽然这种方法要求项目必须有单元测试，但如表 2 所示，这种方法非常实用，因为大多数项目已经有了单元测试。

## Contribution

- 我们提出了一种自动生成可执行文件以对library做fuzzing的新方法；
- 为实用起见，生成的可执行文件与 AFL 等各种灰盒fuzzer兼容；
- 我们将这种方法作为基于 LLVM 框架的工具 FuzzBuilder 来实现。



## Model

### 1. User Configuration

​	要使用FuzzBuilder，用户首先需要提供一个LLVM IR形式的unit test文件和FA（Fuzzable API，用于向目标库传递Input和分析API序列）。

#### 1.1 FA

​	用户需要提供关于FA的信息，包括用于input的参数信息，例如：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818113420.png" style="zoom:50%;" />

​	其中，（1）指明了FA是`CBS_init`，其第2和第3个参数用于指定输入的值和大小；（2）指明了FA是`yr_compiler_add_string`，第2个参数用于指定输入的值，不需要额外的参数来指定大小。

#### 1.2 Test functions

​	Test function进行单元测试的函数，在源代码提供的unit test中有许多函数，但只有部分是test function，故FuzzBuilder需要识别其中哪些是test function。如果单元测试是基于流行的单元测试框架（如 google test [3]），test function名称就会有特定的模式。因此，识别它们并不难。但是，如果单元测试是在没有任何约定的情况下编写的，那么就需要手动指定它们的名称，因为没有明确的方法来识别test function。

​	因此，FuzzBuilder支持可配置选项，通过逐一指定test function的名称来识别这些函数。然而，由于单元测试中有大量测试函数，这种配置非常耗时。幸运的是，大多数项目都使用带有特定前缀或后缀的测试函数名称，如 test_A、test_B、A_test 和 B_test。因此，为了缓解这一问题，FuzzBuilder 支持星号 (*)。

#### 1.3 Functions to be skipped

​	用户可以选择需要跳过的功能。遗憾的是，某些测试函数的执行可能会耗费大量时间。例如，test function中过多的循环就会导致这一问题。如果执行速度慢，灰盒模糊测试的效率就会降低。这是因为灰盒模糊测试需要执行大量程序，用程序生成的各种输入值进行测试。因此，这种配置有助于跳过此类函数，从而提高模糊测试的效率。



### 2. Automated generation of an executable

​	为了生成可执行文件，假设unit test中的以下两个条件都已经被满足：

>1. 每个test都以函数的形式存在；
>2. 每个test互相独立。

​	JUnit [6]是一种流行的 Java 单元测试框架，其最佳实践指南中提到了这些条件。此外，大多数基于 google test的单元测试都满足这些条件。因此，这些条件不会对拟议方法的实用性产生不利影响。

​	生成可执行文件的算法如下：

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818114611.png" style="zoom:50%;" />

- **preprocess**

​	该过程从 LLVM bitcode 文件中的每个函数中提取入口函数和test function。如果单元测试基于流行的测试框架，则会使用特定模式提取test function，否则，它们将根据用户配置提取。入口函数即main函数。

- **insert_interface**

​    这个过程插入了一个接口，用于将fuzzer生成的输入值加载到内存中。首先，添加两个新的全局变量，用于存储输入值及其大小。然后，在提取的入口函数中插入一组指令，以实现以下目标:

1. 从fuzzer中获取输入值；
2. 分配足够的空间以加入一个全局变量；
3. 将输入值复制到全局变量中；
4. 将变量大小存储到另外一个全局变量中。

- **is_necessary**

​    该过程可识别包含调用特定FA的指令的test function，这可以通过遍历测试函数中的指令来实现。然后，如果test function调用了特定的FA，则执行insert_operands，否则执行 remove_test。如果test function是用户配置中跳过的函数，则始终执行 remove_test。

- **insert_operands**

​    该过程将test function中的FA的参数更改为**insert_interface**过程中添加的全局变量，User Configuration用于确定哪些参数需要更改。通过这一过程，可以使用fuzzer生成的输入值执行库中的指令。

- **remove_test**

​    此过程会删除不必要的test functions，删除这些函数很有必要，因为它们会降低生成的可执行文件的执行速度。执行速度对fuzzing的性能有重大影响，因为fuzzing需要尽可能多的输入值。删除test function是安全的，因为我们假设了单元测试之间相互独立。

- **modify**

​    这个过程将插桩过的函数存储在bitcode文件中。根据项目的构建流程，这些插桩文件将被构建为可执行文件。因此，生成的可执行文件带有从fuzzer获取输入值的接口，这些输入值被用作 FA 的参数。最后，fuzzer的输入值可用于探索库代码以发现漏洞。

​	请注意，<u>上述过程是在单元测试可执行文件的编译过程中进行的。因此，如果一个项目有多个单元测试可执行文件，则可生成多个可执行文件</u>。

​	

### 3. Automated generation of seed files

​	大多数项目用以下的方式存储unit test的输入：源码、执行单元测试的脚本文件、额外的文件。

​	要从单元测试中静态提取测试输入，需要使用各种分析工具。例如，如果测试输入是C源代码，那么就需要 C 源代码静态分析器，然而，准备所有类型的静态分析器并不现实。因此，我们采用动态方法，在单元测试工作期间收集测试输入。

​	为此，FuzzBuilder对FA插桩，将其参数值存储到特定文件中。如下图所示，在这段代码中，输入参数表示特定的缓冲区地址，大小参数表示缓冲区的大小，插桩指令用于将输入缓冲区中的值存储到 "file.txt "中。通过这种插桩，在单元测试工作时，每个测试输入都会被收集到一个特定的文件中。最后，将每个种子文件分割成不同的文件，生成种子文件。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818170327.png" style="zoom:50%;" />

​	生成种子的整体工作流程如图所示：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230723143409.png)



## EVALUATION

​	在实验中，我们从OSS-Fuzz中选择了几个库项目，每个项目都有用于fuzzing的可执行文件和种子。大多数可执行文件和种子都是由对库有深入了解的开发人员准备的，通过与这些可执行文件和种子文件进行比较，可以对 FuzzBuilder进行评估。

- **被选择的待测试项目满足以下条件：**

​	(1) 32位；

​	(2) 至少支持一个包含FA的单元测试；

​	(3) 其单元测试满足上述假设条件。

- **AFL版本：**AFL 2.5.b

- **选择的项目：**`c-ares`、`expat`、`boringssl`、`yara`

  <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818171513.png" style="zoom:50%;" />

- **实验配置：**

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818171753.png" style="zoom:50%;" />

-   ​**实验结果：**

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818171918.png)

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230818172017.png" style="zoom:50%;" />

[后续……]