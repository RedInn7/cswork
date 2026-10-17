# TF-IDF and Cosine Similarity

Search and recommendation often turn documents into vectors with TF-IDF: a word weighs more the more often it appears in the document and the rarer it is across the corpus. Given N tokenized documents, implement `tfidf_matrix(docs)` without sklearn, returning an N×V matrix (V distinct words, columns in any order):

- tf(t, d): how many times word t appears in document d.
- df(t): how many documents contain t; idf(t) = ln((1 + N) / (1 + df(t))) + 1 (the smoothed IDF, sklearn's `TfidfVectorizer` default).
- The weight is tf × idf, and then **every row is divided by its L2 norm**.

With normalized rows, two documents' cosine similarity is the dot product of their rows. The driver computes the cosine similarity of Q document pairs and each document vector's largest component.

## Input

The first line holds N and Q. Each of the next N lines holds a word count L and then L words (lowercase letters, repeats allowed). Each of the next Q lines holds two document numbers i and j (from 0, possibly equal).

1 ≤ N ≤ 300, 1 ≤ L ≤ 50, at most 2000 distinct words, 1 ≤ Q ≤ 500.

## Output

The driver prints Q + N, then the Q cosine similarities and the N largest components, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

N = 3. "the" is in all 3 documents, so its idf is ln(4/4) + 1 = 1; "cat" and "sat" are in 2 each, idf = ln(4/3) + 1 ≈ 1.287682; "dog", "ate" and "fish" appear once, idf = ln 2 + 1 ≈ 1.693147. Document 0 is [1, 1.287682, 1.287682] (the, cat, sat), normalized [0.481334, 0.619805, 0.619805]. It shares "the" and "sat" with document 1, for a cosine of about 0.544328. In document 2 "the" appears twice, so its tf is 2.

## Hints

- Give every word a column, count an N×V term-frequency matrix, and (counts > 0).sum(axis=0) is every word's df.
- A word in every document gets idf 1, not 0: the smoothing's "+ 1" keeps common words from vanishing entirely.
- Normalize with np.linalg.norm(w, axis=1, keepdims=True); documents are never empty, so no norm is 0.
