---
date: 2021/11/06 15:56:09
title: Semantic Host-free Trojan Attack
author: Shaw
categories: Paper
tags: [ "AD"]
---

# Semantic Host-free Trojan Attack

>**作者：Haripriya Harikumar , Kien Do, Santu Rana , Sunil Gupta , Svetha Venkatesh（迪肯大学.澳大利亚）**
>
>**时间：2021.10.27**



### ABSTRACT

​	在本文中，我们提出了一种新颖的host-free木马攻击，其触发器(trigger)固定在语义空间(semantic)，但不一定在像素空间(pixel)。

​	与现有的木马攻击使用干净的输入图像作为宿主来携带小的、没有意义的trigger不同，我们的攻击将trigger看作是属于语义上有意义的对象类的整个图像。

​	由于在我们的攻击中，与任何特定的固定模式相比，分类器被鼓励记忆触发图像的抽象语义。因此它可以在以后由语义相似但看起来不同的图像触发。这使得我们的攻击更实际地被应用于现实世界中，更难以防御。广泛的实验结果表明，仅用少量的特洛伊木马模式进行训练，我们的攻击能很好地推广到同一特洛伊木马类的新模式，并且可以绕过目前的防御方法。

------

### INTRODUCTION

​	提出了一个**后门攻击**，semantic host-free backdoors。

​	**后门攻击综述：**[(20条消息) 深度学习后门攻防综述_Yale的博客-CSDN博客_后门攻击](https://blog.csdn.net/yalecaltech/article/details/117249586)

​	<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211109200409.png" style="zoom:50%;" />

------

### METHOD

​	实现方式：数据投毒。

​	