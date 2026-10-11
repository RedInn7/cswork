// Loaded on demand for pages whose source used math, so KaTeX stays out of the main bundle.
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export { remarkMath, rehypeKatex };
