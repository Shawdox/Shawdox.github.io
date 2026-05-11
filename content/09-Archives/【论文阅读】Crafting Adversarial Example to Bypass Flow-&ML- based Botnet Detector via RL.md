---
date: 2021/10/30 11:06:44
title : Crafting Adversarial Example to Bypass Flow-&ML- based Botnet Detector via RL
author: Shaw
categories: Paper
tags: [ "RL", "Botnet"]

---

# Crafting Adversarial Example to Bypass Flow-&ML- based Botnet Detector via RL

>**作者：Junnan Wang，Qixu Liu，Di Wu，Ying Dong，Xiang Cui（中国科学院大学，华为科技，北京维纳斯纲科技，广州大学）**
>
>**时间：2021.10.6**
>
>**会议：RAID(CCF_B)**

#### 	1. Botnet(僵尸网络)：

##### 		1.1 定义：

​	Botnet = robot + network。

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211030111947.png)

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211030112012.png)

> ----参考《软件安全》.彭国军

##### 	1.2 如何攻击？

​	一个僵尸网络的生存周期包括**<u>形成、C&C、攻击、后攻击</u>**四个阶段。

​	形成阶段由攻击者入侵有漏洞的主机，并在其上执行恶意程序，使之成为僵尸主机。

​	一旦成为僵尸主机之后，botmaster会通过各种方式与之通信。

​	之后根据botmaster的指令执行攻击行为。后攻击阶段是指botmaster对僵尸网络进行升级更新。

#### 	2. Botnet Detector(僵尸网络检测器)：

##### 		2.1 传统方法：

​	从检测原理上来说，大致可以分为三类方法：

　　·行为特征统计分析

　　·bot行为仿真以监控

　　·流量数据特征匹配

​	传统的检测僵尸网络的方法一般在形成、攻击阶段，利用僵尸主机存在的行为特征，例如通信的数据内容。一些基于网络流量行为分析的方法可以检测僵尸网络，主要是从**通信流量特征**的角度去检测的，例如流量的通信周期，这种方法可以检测出一些加密的僵尸主机流量，同时还可以检测出新型的僵尸网络。

>----参考：[解析：僵尸网络（Botnet）的检测方法-西湖泛舟-ChinaUnix博客](http://blog.chinaunix.net/uid-20597254-id-1918281.html)

------

### ABSTRACT

​	提出了一个<u>基于RL</u>的方法来对<u>基于ML的僵尸网络追踪器</u>做逃逸攻击，并且可以保留僵尸网络的恶意功能。

​	黑盒攻击，不用改变追踪器本身。

------

### INTRODUCTION

​	训练一个RLagent，让其通过与追踪器的交流反馈自己学习如何扰动样本。

​	为了确保功能的保留，我们设计了一个包含14个增量操作的操作空间，每个操作只向原始流中添加一个精心编制的数据包，以尝试更改一些流级特性。检测器认为这些特征具有区分性，但这可能不是良性交通的因果指标。

​	此外，添加数据包是传输层的增量操作，而恶意数据一般封装在应用层。

​	这种攻击方法的优点：

 	1. 黑盒攻击；
 	2. 它具有通用性，不论探测器的损失函数是否可微，都可以使用；
 	3. 即插即用，RL智能体可以作为网络代理存在，逃逸成本低并且适用于任何botnet家族。

​	主要贡献：

	1. 提出一个黑盒攻击方法；
 	2. 在RL框架中设计了一些列通用动作空间，这些动作都是添加操作，在可以逃逸的前提下保证了恶意样本的功能性；
 	3. 我们演示了如何训练和部署我们的系统以避免在精心构建的僵尸网络流数据集上进行ML检测，并综合评估框架的逃避性能、时间开销和通用性。

------

### RELATED WORK

#### 	Botnet Evasion:

- 传统botnet逃逸方法：加密网络流；在TCP/IP协议簇的冗余字段中隐藏C & C信息(command and control)；使用online-social-networks(OSN)来构建隐藏的通道。

- ML-based逃逸方法：

  1. **Feature space attack：**指的是只能生成traffic对抗特征向量的方法。但是，考虑到traffic样本映射到特征向量的过程是不可逆的，这样的攻击不能造成实际的安全威胁，只能用来证明基于ML的检测器的脆弱性。

  2. **End-to-end attack：**指的是可以生成真正的traffic数据的方法。

     【35】利用了GAN来模仿facebook聊天网络的traffic以此绕过自适应IPS。

     【36】利用了GAN来生成尽量真实的traffic，以此来提高数据集的质量，解决数据不平衡问题。

------

### THREAT MODEL AND SYSTEM FRAMEWORK

 1. **Threat Model**
- **攻击者的目的：**生成对抗样本，隐藏botnet flow。
    
- **攻击者的信息：**1. 攻击者理解目标网络可能被流等级（flow-level）ML网络检测系统保护；2. 攻击者不需要知道detector的算法，参数，特征或训练数据等信息。
    
- **攻击者的能力：**1. 攻击者只有能力修改测试集，并不能改变detector的训练集；2. 同时，我们假设攻击者可以持续访问detector，从检测器中获取二进制预测结果。
    
 2. **System Design**

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031113229.png)

​	见图即可，简单的RL学习模型。

3. **RL Algorithm**

   选择了（value-based）DQN和SARSA，都用。

 4. **Action Space**

    **Q：如何在不影响原来功能的情况下添加扰动？**

    A：因为botnet内容在应用层，故可以对传输层进行扰动。（<u>PS：这样确实不会改变功能，但是应用层的恶意特征不会仍被detector检测到吗？</u>）

    **Q：如何确定哪个特征该进行扰动？**

    A：考虑到动作设计的困难，从僵尸网络检测中常用的特征集合中选取18个特征。

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031115102.png)

    ​	由上述特征，基于botnet和normal flow的差异，action space包含了14个动作，这些动作可以影响以上的统计特征，例如简单修改数据包的时间戳，或者添加构建的新数据包。

    ​	当在构建新数据包时，考虑三个地方：时间戳，方向，包的大小。

    ​	14个动作被分成了5类：

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031115453.png)

    

    具体见原文。

 5. **State Space**

    ​	detector返回的二进制信息很难直接使用，需要有一个状态生成器来生成供agent使用的state。

    ​	这里使用堆叠自编码器（Stacked Autoencoder，SAE）来自动提取botnet flow的特征，然后将其返回给agent以作为state。

    ​	将每个botnet flow的前1024个字节作为SAE的输入，经过一些epoch的训练，SAE就可以自动地从botnet flow中学习到一个256维度的state vector。

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031152136.png)

------

### EXPERIMENTAL SETUP

 1. **Implementation**

    系统的位置如下：

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031152307.png"  />

    作为BotMaster的一个代理存在。

 2. **Dataset**

    两个公开数据集：CTU，ISOT。

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031152816.png)

    然后做一下数据处理：

    <img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031153008.png" alt="image-20211031153006310" style="zoom:80%;" />

    1. 合并属于同一botnet 家族的样本，如果某个pcap包太大，就舍弃；
    2. 将pcap包切片；
    3. 匿名化，将ip,mac等包中独一无二的东西随机化，以避免影响。

 3. **Detector**

    ​	选取了两个state-of-art的detector: **the composite DL detection model combining CNN**

    **with LSTM(*BotCatcher detection model*)**，**the non-differentiable ML detection model based on XGBoost(*XGBoost detection model*)**。

    ​	![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031154038.png)

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211031154144.png)

------

### RESULTS

 1. **Evasion performance**

    将DQM,SARSA与BotCatcher,XGBoost两两组合：

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211101153359.png)

    逃逸率如上图所示，可以看到，即使是随机扰动都有一定的逃逸率。

    不同测试集效果差异很大：

    	1. 数据包可能过大（storm），导致对时间戳做修改等操作对结果的影响很小；
    	2. 数据包的特征跟其它数据集差别很大，导致模型难以在有限的步骤时间里改变足够多的特征。

 2. **Time performances**

    ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211101155037.png)

 3. **Dominant actions**

    **Dominant actions**指的是agent在创建对抗样本时采用的最频繁的操作。

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211101155358.png)