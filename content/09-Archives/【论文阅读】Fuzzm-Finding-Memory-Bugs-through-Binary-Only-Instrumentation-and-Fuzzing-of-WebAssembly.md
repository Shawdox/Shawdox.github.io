---
date: 2023/07/04 11:06:36
title: (论文阅读)Fuzzm-Finding Memory Bugs through Binary-Only Instrumentation and Fuzzing of WebAssembly
author: Shaw
categories: Paper
tags: ["Fuzzing","WASM"]
---

# Fuzzm: Finding Memory Bugs through Binary-Only Instrumentation and Fuzzing of WebAssembly

>**时间：**2021
>
>**作者：**Daniel Lehmann（德国斯图加特大学），Martin Toldam Torp（丹麦奥胡斯大学）

## Abstract

​	WebAssembly二进制文件通常是由内存不安全的语言，如C和C++编译而成。由于WebAssembly的线性内存和缺失的保护功能，例如堆栈canaries，源码级的内存漏洞在编译的WebAssembly二进制文件中是可以利用的，有时甚至比本地代码更容易。

​	本文通过第一个只针对WebAssembly的二进制fuzzer来解决检测此类漏洞的问题。我们的方法被称为Fuzzm，它结合了检测堆栈和堆的溢出的canaries插桩、有效的代码覆盖率插桩、WebAssembly虚拟机和一个流行的AFL fuzzer的输入生成算法。除了作为fuzzer的oracle，我们的canary还可以作为独立的二进制加固技术，以防止生产中的脆弱二进制文件被利用。

​	我们用28个真实世界的WebAssembly二进制文件来评估Fuzzm，其中一些是从源代码编译的，还有一些是在野外发现的，没有源代码。该fuzzer探索了数以千计的执行路径，触发了几十次崩溃，每秒执行数百次程序执行。当用于二进制加固时，该方法可以防止先前公布的针对脆弱的WebAssembly二进制文件的漏洞，同时施加较低的运行时间开销。



## 问题背景

​	

## 贡献  

​	

## 模型

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20230704113244.png" style="zoom:67%;" />

