---
date: 2024/01/02 
title: (技术积累) Linux系统工作环境搭建
author: Shaw
categories: Paper
tags: ["Configuration"]
---

# Linux系统工作环境搭建

>系统：Ubuntu 20.04
>
>用户名：wx

Linux系统相关配置整理。



- 美化PS1:

```bash
#添加到~/.bashrc
echo "export PS1='\[\e]0;\u@\h:  \W\a\][\[\033[01;36m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\W\[\033[00m\]]\n\[\033[01;32m\]$ >\[\033[00m\] '" >> ~/.bashrc && source ~/.bashrc
#Autosuggestions
git clone --recursive https://github.com/akinomyoga/ble.sh.git
make -C ble.sh
source ble.sh/out/ble.sh
```

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240102192311001.png" style="zoom:80%;" />

- sudo用户组

```bash
sudo chmod +w /etc/sudoers
echo "wx   ALL=(ALL:ALL) ALL" >> /etc/sudoers
```

- ssh密钥登陆[[设置 SSH 通过密钥登录 | 菜鸟教程 (runoob.com)](https://www.runoob.com/w3cnote/set-ssh-login-key.html))：

```bash
#window客户端
#cmd
ssh-keygen -t rsa
scp -P 2253 C:\Users\Shaw\.ssh\id_rsa.pub wx@222.20.94.23:~/.ssh
#Linux
sudo apt install ssh
#如果没有这个文件夹就先连接自己一次
cd ~/.ssh
cat id_rsa.pub >> authorized_keys
chmod 600 authorized_keys
chmod 700 ~/.ssh
# 将/etc/ssh/sshd_config设置：PubkeyAuthentication yes
sudo service sshd restart
```

1. 如果Linux是虚拟机，需要配置VMWare的NAT端口映射（主机是固定IP，这里映射为主机的2024端口）：

![](https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20240102193515812.png)

2. 如果需要管理多台虚拟机，密钥配置需要指定具体私钥文件的路径：

```
Host 10.12.189.55
  HostName 10.12.189.55
  User wx
  Port 2024
  IdentityFile C:\Users\Shaw\.ssh\id_rsa_Eunomia
```

- 换源：

```bash
#一定先切换root用户
apt install curl
sudo -i
bash <(curl -sSL https://gitee.com/SuperManito/LinuxMirrors/raw/main/ChangeMirrors.sh)
```

- 关闭系统自动休眠：

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

- 相关工具：

```bash
sudo apt-get install software-properties-common
# ssh
sudo apt-get install openssh openssh-service openssh-client 
# network
sudo apt-get install net-tools
# text
sudo apt-get install vim jq
# download
sudo apt-get install curl
# git
sudo apt install git
# make
sudo apt install gcc clang make cmake
# 32bit
sudo dpkg --add-architecture i386 && sudo apt-get update  
sudo apt-get install libc6:i386 libncurses5:i386 libstdc++6:i386 libz1:i386
# openssl dev
sudo apt-get install libssl-dev
# Conda
wget https://mirrors.bfsu.edu.cn/anaconda/archive/Anaconda3-2022.10-Linux-x86_64.sh --no-check-certificate
bash Anaconda3-2022.10-Linux-x86_64.sh
source ~/.bashrc
# screen 
 sudo apt install screen
# mail
sudo apt-get install sendmail sendmail-cf mailutils
# docker
sudo apt-get  install docker.io --fix-missing
sudo groupadd docker
sudo gpasswd -a ${USER} docker
sudo systemctl restart docker
sudo chmod a+rw /var/run/docker.sock

```

