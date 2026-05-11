---
date: 2021/11/01 21:16:57
title : Def-IDS An Ensemble Defense Mechanism Against Adversarial Attacks for Deep Learning-based Network Intrusion Detection
author: Shaw
categories: Paper
tags: [ "AD"]
---

# Def-IDS: An Ensemble Defense Mechanism Against Adversarial Attacks for Deep Learning-based Network Intrusion Detection

>**作者：Jianyu Wang，Jianli Pan，Ismail AlQerm，（密苏里大学圣路易斯分校，重庆大学）**
>
>**时间：2021**
>
>ICCCN，ccf--C类



### ABSTRACT

​	提出了**Def-IDS**，一个为NIDS准备的组合防御机制。它是一个由两个模块组成的训练框架，组合了multi-class generative adversarial networks**（MGANs）**和multi-soutce adversarial retraining（**MAT**）。

​	在CSE-CIC-IDS2018数据集上测试了该机制，并与3个其它方法进行了比较。结果表明Def-IDS可以以更高的**precision, recall, F1 score, and accuracy**来识别对抗样本。

------

### INTRODUCTION

​	**Internet of Things(IoT):**物联网

​	**intrusion  detection systems (NIDS)**

​	提出了一个整合基于对抗训练的防御机制，用于提升DL-based的intrusion detectors的鲁棒性。

​	4个贡献：

1. 模型由两个模块组成，组合了multi-class generative adversarial networks**（MGANs）**和multi-soutce adversarial retraining（**MAT**），可以在保证准确率的前提下对抗攻击；
2. **MGANs**可以通过同时过采样多类入侵来增强原始训练数据集，以减少训练与真实数据分布之间的差距。通过使用提升过的数据进行训练，detector的对已知和未知攻击的鲁棒性更强；
3. **MAT**通过投喂多种不同的对抗样本来retraining，MAT不仅对抗某种特定的攻击，并且可以一定程度抵御对样样本的转移性；
4. 我们进行了一些state-of-the-art攻击并且在CSE-CIC-IDS2018数据集上测试了该机制，结果很好。

------

### RELATED WORK

------

### ADVERSARIAL ATTACK THREAT MODELS

- 采用的攻击方法：FGSM，BIM，DeepFool，JSMA

------

###  PROPOSED DEF-IDS DEFENSE MECHANISM

#### 	1. *Mechanism Overview*

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102215521.png)

#### 	2. *Module 1: Multi-class GAN-based Retraining*

####     3. *Module 2: Multi-source Adversarial Retraining*

#### 	4. *Ensemble Adversarial Retraining*

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102220240.png)

------

### EVALUATION

#### 	1.  *Dataset and Metrics*

​	**数据集**：CSE-CIC-IDS2018（CIC出版）（通用）

​	与其他过时的数据集相比，其含有综合性的攻击方法和更平衡的数据。

​	其含有Brute-force, Heartbleed,Botnet, DoS, DDoS, Web attacks 和  infifiltration of the network共7种恶意流量。

​	**数据处理：**

 1. 使用Min-Max standardization将所有特征的值映射入[0,1]；

 2. 有四个特征有太多空值或者无限值（dstport, protocol, flflow byts/s, flflow pkts/s），有一个特征（timestamp）与流量无关，将这5个特征剔除；还剩下76个特征。

 3. training,validation,test = 8:1:1，随机划分。

​	**Detector的评价方法：**

​	混淆矩阵。

#### 	2. *Baseline Detector Implementation*

##### 	2.1 *Detector Implementation*

​	选取baseline detector C~base~。其由一个输入层，两个隐藏层和一个输出层组成（76-128-64-8）。

​	隐藏层都是全连接层+ReLU。

​	输出层使用Softmax。

​	代码用keras写的，系统Ubuntu 18.04,3.6GHz CPU和16GB内存。

​	优化器用Adam，学习率0.001,20个epoch。

​	在训练过程中，进行十次交叉验证并计算平均度量值。

​	训练结束后，利用测试数据集对Cbase进行评估。

##### 	2.2  *Adversarial Attacks against Baseline Classififier*

​	使用python库**foolbox**来生成对抗样本；

​	FGSM，BIM，DeepFool，JSMA四种攻击方法都使用，具体效果如下图所示：

​	![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102213923.png)

#### 	3.  *Def-IDS Defense Evaluation*

C~gan~是使用GAN生成的样本再训练的detector;

C~at~是使用9:1的纯净数据：恶意数据再训练出的detector;

C~ensem~是二者的结合.

##### ![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102214213.png)

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102215325.png)

#### 	4.  *Comparison with Other Works*

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102215346.png)

#### 	5.  *Cost Estimation*

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/20211102215401.png)