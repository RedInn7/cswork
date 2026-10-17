'use client';

import track from '@/lib/content/ml-coding.json';
import { ProblemTrack } from './sql-track';
import type { Navigate } from './learning';

/**
 * ML Coding (?view=problems&library=ml): metrics, classic models, deep learning building blocks
 * and statistics written from scratch with numpy, each a function above a fixed driver, Python only.
 * Built with its packages by scripts/ml-coding/build.ts; listed once the judge reports pandas (and so numpy).
 */
export function MlCoding(props: {
  navigate: Navigate;
  availableProblemIds: string[];
  activity: { problem_id: string }[];
  signedIn: boolean;
}) {
  return (
    <ProblemTrack
      {...props}
      library="ml"
      track={track}
      copy={{
        kicker: ['ML Coding · numpy', 'ML Coding · numpy'],
        title: ['机器学习手写实现', 'Machine Learning by Hand'],
        lead: [
          'ML 和数据岗位的面试常让你不调 sklearn、只用 numpy 手写：混淆矩阵与 F1、ROC-AUC、KNN、k-means、岭回归、逻辑回归、决策树切分、softmax、注意力、卷积、TF-IDF、自助法和 PCA。每道题上半部分是要补全的函数，下半部分是固定的驱动：读入数据、调用你的实现、按 6 位小数打印结果，和标准答案相差不超过 10⁻⁵ 就算通过。只能用 Python 提交。',
          'ML and data interviews often ask you to write these with numpy alone, no sklearn: a confusion matrix and F1, ROC-AUC, KNN, k-means, ridge and logistic regression, a decision tree split, softmax, attention, convolution, TF-IDF, the bootstrap and PCA. Each starter has the functions to fill in on top and a fixed driver below that reads the data, calls your code and prints the results to 6 decimals; within 10⁻⁵ of the expected answer passes. Submit in Python.',
        ],
        progress: ['ML Coding 进度', 'ML Coding progress'],
        empty: ['ML Coding 正在上线，稍后再来。', 'ML Coding is being published. Check back soon.'],
      }}
    />
  );
}
