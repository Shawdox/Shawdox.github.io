---
date: 2025/5/26
title: (Paper)KernelGPT- Enhanced Kernel Fuzzing via Large Language Models
author: Shaw
categories: Paper
tags: ["Syzkaller","Fuzzing","Kernel"]
---

# KernelGPT: Enhanced Kernel Fuzzing via Large Language Models

>ASPLOS'25
>
>Chenyuan Yang, UIUC



### BACKGROUND

Generating **syscall specifications** is non-trival and hard to be automated by traditional methods. Existing syzkaller specifications only cover a small portion of syscalls.



### METHOD

KernelGPT focus more on drivers and sockets.

![](figures/image-20250526105923084.png)



### EVALUATION

