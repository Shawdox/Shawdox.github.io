---
date: 2023/12/26
title: (论文阅读)CODAMOSA-Escaping Coverage Plateaus in Test Generation with Pre-trained Large Language Models
author: Shaw
categories: Paper
tags: ["Software Testing", "LLM"]
---

# （论文阅读)CODAMOSA: Escaping Coverage Plateaus in Test Generation with Pre-trained Large Language Models

>时间：2023.5
>
>作者：Caroline Lemieux(University of British Columbia), Jeevana Priya Inala(Microsoft)
>
>会议：ICSE'23
>
>开源：https://github.com/microsoft/codamosa

## ABSTRACT

通过将test case generation与mutation相结合，SBST为待测试程序生成高覆盖率的test cases。SBST的表现依赖于生成test cases的合理概率，这些test cases可执行被测程序的核心逻辑。使用这些test cases，SBST可以探索这些cases周围的空间来探索更多的程序空间。

这篇文章探索了例如OpenAI的Codex等LLM是否可以被用于帮助SBST的搜索过程。我们提出了名为CODAMOSA的方法，其首先执行SBST直到覆盖率提升停滞，接着询问Codex提供example test cases来探索没未访问过的函数。这些examples帮助SBST调整其搜索方向到更有用的领域。在486个benchmarks上的evaluation结果表明，与仅有SBST或者仅有LLM相比，CODAMOSA在更多benchmark（173 和 279 个）上实现了更高的覆盖率明显，其数量高于其减少的覆盖率数量（10 和 4 个）。



>SBST+LLM for Python

## Background

Automated test case generation的目的是生成涵盖被测程序所有不同行为的测试用例。如果测试用例涵盖了开发人员没有考虑到的行为，就能帮助开发人员发现错误，或以其他方式提高程序质量。一种方法是基于搜索的软件测试（SBST）[1]-[5]。大多数先进的 SBST 工具都基于某种形式的进化算法。在高层次上，这些算法首先创建一组随机测试用例，然后反复变异这些测试用例，并保留适应性较高的测试用例，以便进一步变异。通常情况下，更高的适应性与更高的被测程序覆盖率有关。

**Coverage Pateaus:**

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20231226155755867.png" style="zoom:67%;" />

如这张图所示，函数`bump_version`的功能是获取“1.2.2”这样的版本信息，然后将返回"1.2.3"新版本字符串。对于SBST，其可以生成类似`‘a\!sUo ̃AU’`这样的随机字符串，但其对探索函数`bump_version`几乎没有帮助。**Coverage Pateaus**指代这里即使变异特定的输入也无法获取更高覆盖率的情况。

导致这些Coverage Pateaus的一个核心问题是，SBST 难以以预期的方式执行被测程序（PUT）[7]。例如，在以上示例中，`bump_version`希望它的第一个参数是一个特定格式的字符串。或者，程序可能希望通过特定的函数调用序列来正确构造一个对象[8]。我们假设，如果我们为 SBST 提供测试用例，让它以预期的方式执行 PUT，那么 SBST 的搜索就能摆脱Coverage Pateaus。困难在于如何生成这些符合预期的测试用例。

## Methodology

最近，应用于代码（如 Codex [9]）的大型语言模型（LLMs）在生成自然美观的代码方面取得了令人印象深刻的成果。在本文中，我们将研究是否可以有选择性地调用 LLM 来生成测试用例，从而帮助 SBST 摆脱覆盖率停滞的问题。

我们提出的 CODAMOSA 技术会启动 SBST 并监控其覆盖率进度。当 CODAMOSA 发现覆盖率出现停滞时，它会识别出PUT中覆盖率较低的可调用对象。然后，它会查询 Codex，为这些可调用对象生成测试。在这些生成的基础上，CODAMOSA 将 Codex 生成的原始字符序列反序列化为 SBST 的内部测试用例表示法。这样，它就能利用 SBST 的突变操作和适配函数来突变和评估 Codex 生成的测试的质量。

**<u>这里在 Pynguin [10] 测试套件生成框架之上为 Python 构建了 CODAMOSA。</u>**我们在486个Python模块上对 CODAMOSA进行了大规模评估。我们发现，与SBST和单独的LLM base-line相比，CODAMOSA 在更多benchmark（173 和 279）上实现的统计覆盖率明显高于其减少的覆盖率（10 和 4）。覆盖率提高的平均幅度（10% 和 9%）也高于覆盖率降低的平均幅度（-4% 和 -3%）。

<img src="https://shaw-typora.oss-cn-beijing.aliyuncs.com/image-20231226161334478.png" style="zoom: 67%;" />

## Contributions

- 提出了CODAMOSA，一个结合了SBST和LLM的技术，它包括将任意 Python 测试用例集成到 SBST 的技术，无论其来源如何；
- 在 486个benckmark中对CODAMOSA、其设计决策和baselines进行了大规模评估；
- 开源：https://github.com/microsoft/codamosa

