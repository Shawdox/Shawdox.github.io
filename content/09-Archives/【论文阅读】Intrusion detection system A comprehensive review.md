---
date: 2021/11/03 09:58:09
title: Intrusion detection system-A comprehensive review
author: Shaw
categories: Paper
tags: [ "IDS"]

---

# Intrusion detection system: A comprehensive review

>**作者：Hung-Jen Liao a , Chun-Hung Richard Lin a,n , Ying-Chih Lin a,b , Kuang-Yuan Tung a（国立中山大学，正修科技大学）**
>
>**时间：2012**

### ABSTRACT

​	一个IDS综述。

PS：[(17条消息) 防火墙、IDS和IPS之间的区别（浅谈）_淡风wisdon－大大的博客-CSDN博客](https://blog.csdn.net/haoxuexiaolang/article/details/106562102?spm=1001.2101.3001.6661.1&utm_medium=distribute.pc_relevant_t0.none-task-blog-2~default~CTRLIST~default-1.no_search_link&depth_1-utm_source=distribute.pc_relevant_t0.none-task-blog-2~default~CTRLIST~default-1.no_search_link)

------

### INTRODUCTION

​	**CIA：**Confifidentiality, Integrity and Availability，

​	**Instrusion:** 针对CIA的破坏行为，或者绕过计算机或网络安全机制的行为。

​	**Instrusion detection:** 是监视计算机系统或网络中发生的事件，并分析它们以发现入侵迹象的过程。

​	**Instrusion detection sysytem(IDS):** 实现instrusion detection自动化的软件或硬件。

​	**Instrusion prevention system(IPS):** 不仅有IDS的监控功能，还可以阻止可能的突发安全事件。在少数文章中，入侵检测与防御系统( IDPS )和入侵防御系统( IPS )是同义词，其中IDPS一词在安全界很少使用。

------

### DETECTION METHODOLOGIES

​	Detection的方法一共分为三类：Signature-based Detection (**SD**), Anomaly-based Detection

(**AD**) and Stateful Protocol Analysis (**SPA**)。

#### 	1. SD（特征检测）:

​	Signature-based Detection，特征检测。将已知的patterns与捕获的事件进行比较，从而发现可能的入侵。因为使用特定攻击或者系统漏洞所积累下的知识，SD又被称为Knowledge-based Detection 或者 Misuse Detection。

#### 	2. AD（异常检测）：

​	Anomaly-based detection，异常检测。一个异常（anomaly）指的是与已知行为相异的地方。Profiles表示定期从活动，网络连接中监视的正常或特定的行为文件，profile可以是静态的也可以是动态的，并且从许多特性中生成。例如，登录失败，处理器的使用，邮件的发送数量等。

​	接下来，AD 比较器就将正常的profile与观察到的事件相比较，以此辨别出显著的攻击。AD又被称为Behavior-based Detection。

​	一些AD的例子，例如，企图闯入、伪装、合法用户渗透、拒绝服务( DOS )、特洛伊木马等。

#### 	3. SPA（状态协议分析）：

​	Stateful Protocol Analysis，状态协议分析。Stateful指的是IDS可以知晓并追踪协议的状态（举例，将请求与答复配对）。

​	尽管SPA与AD很像，二者其实完全不同。AD采用预加载的网络或者特定域名的profile，然而SPA依赖于供应商开发的特定协议**通用profile**。通常，SPA中的网络协议模型最初基于国际标准组织(例如IETF )的协议标准。SPA也被称为Specifification-based Detection（基于规格的检测）。



大多数IDS使用多种方法来提供更广泛和准确的检测。

------

### DETECTION APPROACHES

​	此文将已有的方法分为了5类：Statistics-based, Pattern-based, Rule-based, State-based and

Heuristic-based。

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211106153047.png)

​	由上图所示，其中，Time series指的是是否考虑了time series behavior。