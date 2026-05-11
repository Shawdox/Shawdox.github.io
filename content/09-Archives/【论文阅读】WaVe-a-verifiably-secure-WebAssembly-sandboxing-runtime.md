---
date: 2024/02/25
title: (论文阅读)WaVe-a verifiably secure WebAssembly sandboxing runtime
author: Shaw
categories: Paper
tags: ["WebAssembly"]
---

# WaVe: a verifiably secure WebAssembly sandboxing runtime

>**作者：**Evan Johnson(UCSD), Evan Laufer(Stanford), Zijie Zhao(UIUC), Fraser Brown(CMU)
>
>**会议：**SP'23

## Abstract

WebAssembly (Wasm) 是一种流行的可移植字节码，其编译器会自动插入运行时检查，以确保数据流和控制流被限制在单一内存段内。事实上，现代编译后的Wasm程序已经发展到可以自行验证这些检查的程度，从而将编译器从可信计算基础中移除。

然而，由此产生的完整性属性仅对严格在 Wasm 沙箱内执行的代码有效。与运行时系统的任何交互（运行时系统管理沙箱并公开用于访问操作系统资源的 WebAssembly 系统接口 (WASI)）都是在此契约之外进行的。<u>由此产生的难题是，如何在保持 Wasm 强大隔离特性的同时，还允许此类程序与外部世界（即文件系统、网络等）进行交互</u>。

我们的论文通过实现 WASI 的已验证安全运行时系统 WaVe 提出了这一问题的解决方案。我们从机制上验证了与 WaVe 的交互（包括操作系统的副作用）不仅能保持 Wasm 的内存安全保证，还能保持对主机操作系统的存储和网络资源的访问隔离。我们从机制上验证了与WaVe的交互（包括操作系统的副作用）不仅能保持Wasm的内存安全保证，还能保持主机操作系统存储和网络资源的访问隔离。最后，尽管运行时完全脱离了可信计算基础，我们还是证明了WaVe的性能可与现有的工业（但不安全）Wasm运行时媲美。



## Motivation

**传统的Wasm Runtime针对WASI的内存完整性和资源完整性验证并不完善。**

#### 1. Memory isolation problem

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240225153854138.png" style="zoom:67%;" />

上图是一个从密码学库NaCl中截取的C++代码片段，其中的if-else用于判断当前的offset+len是否超出了内存边界，如果没有则将这段内存的内容拷贝到共享内存中。这里就存在一个整数溢出漏洞（offset+len可以很大）。

很多Wasm runtime都存在这类整数溢出bug。

#### 2. Resource isolation problem

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240225154539358.png" style="zoom:67%;" />

上图是Wasmer中的部分源码，第4行hostcall从sanbox中读取路径，第7行hostcall检查该路径是否在sandbox可以访问的路径之中并重写路径到对应根目录，但第10行直接删除了未经验证的path，这很可能导致runtime删除其访问范围之外的文件。

在Wasmer中，有些路径检查是正确的，但这个例子就是错误的。这个例子很好的体现了目前runtime安全策略的现状：<u>**开发人员有责任在所有正确的地方设置所有正确的检查**</u>。

作者表明，可以使用自动验证器来检查运行时的隔离策略是否正确，而不是把正确性的责任推给开发人员，并将运行时代码从 TCB 中完全删除。

## Method

WaVe 不依赖于开发人员对 POSIX 和操作系统语义的隐性了解，而是使用显性的操作系统规范(OS Specifications)，描述每个系统调用对用户空间内存和操作系统的影响。

WaVe 不依赖于开发人员在所有正确的地方设置所有正确的安全检查，而是使用单一的集中式、可审计和可测试的安全策略，并通过自动验证器来执行。总的来说，WaVe 通过静态证明系统调用的安全使用，实现了内存隔离、文件系统隔离和网络隔离（在安全策略中进行了描述）。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240225155638236.png" style="zoom:67%;" />

上图是WaVe的`wasi_path_remove_directory`函数的实现，其中注释是用来解释Verifier功能的，并不是真的有这段代码。

WaVe会要求developer在一些函数后面加上一些**<u>postcondition</u>**(后置条件)，用于目标函数后自动进行检查。例如，`ctx.translate_path()`函数后就会进行`is_in_sbox_fs()`，即host_path是否位于sandbox可访问范围内的检查。

在第 21 行，hostcall 调用操作系统删除目录。Verifier认识到 `unlinkat `正在读写操作系统状态（根据OS Specifications），因此会静态检查 host_path 是否在沙盒的根目录内。

如果代码存在漏洞，而验证器又无法保证 host_path 位于沙箱的根目录中，验证器就会出错，甚至无法编译有漏洞的代码。

#### Threat Model

1. 假设Wasm runtime的代码是恶意的，其会通过一系列hostcalls来逃逸；
2. 不考虑runtime内的data corruption和控制流劫持，因为已经有相关防御工具；
3. 假设sandbox被分配了一个root directory，其包含了可以访问的所有数据；
4. root directory只包含常规文件、符号链接和受信任的设备文件（没有类似`/proc/self/mem`这类的特殊文件）；
5. 假设一个sandbox只有一个线程，并且WASI公开的所有函数都是synchronous的。

#### Design



<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240227103916643.png" style="zoom: 67%;" />

WaVe 是一个实现了 WebAssembly 系统接口的 Wasm runtime，它向sandbox提供了 45 个WASI相关的hostcall，沙盒在需要访问文件系统或网络等操作系统资源时会调用这些hostcall。WaVe还管理用于执行主机调用的沙盒特定状态，如沙盒的开放文件描述符列表。

当sandbox发起一个hostcall时，WaVe就会像其它Wasm runtime那样，动态地检查这个call的参数是否安全（例如指针是否在sandbox的内存范围内），接着将这些参数调用转化为对应OS的表示形式，最后将hostcall的返回结果送回sandbox。**<u>WaVe与其它Wasm runtime不同的是，其会静态检查check-and-translate这个过程以保证runtime的安全性。</u>**