# Intent Classifier F1 Comparison: Rule-Based vs Hybrid LLM

| Subset | System A Rules (macro F1) | System B Hybrid (macro F1) | Δ | McNemar p |
|---|---|---|---|---|
| English-only | 0.816 | 0.919 | +0.103 | 0.1306 |
| Thai-only | 0.567 | 0.921 | +0.354 | 0.0023 ✓ |
| Combined | 0.705 | 0.920 | +0.215 | 0.0003 ✓ |

## English-only

**System A (Rule-based)**  macro F1 = 0.816
```
              precision    recall  f1-score   support

product_info       0.60      0.90      0.72        10
  size_guide       1.00      0.70      0.82        10
 stock_check       1.00      0.50      0.67        10
store_policy       1.00      1.00      1.00        10
out_of_scope       0.77      1.00      0.87        10

    accuracy                           0.82        50
   macro avg       0.87      0.82      0.82        50
weighted avg       0.87      0.82      0.82        50
```

**System B (Hybrid LLM)**  macro F1 = 0.919
```
              precision    recall  f1-score   support

product_info       1.00      1.00      1.00        10
  size_guide       0.77      1.00      0.87        10
 stock_check       1.00      0.70      0.82        10
store_policy       0.91      1.00      0.95        10
out_of_scope       1.00      0.90      0.95        10

    accuracy                           0.92        50
   macro avg       0.94      0.92      0.92        50
weighted avg       0.94      0.92      0.92        50
```

## Thai-only

**System A (Rule-based)**  macro F1 = 0.567
```
              precision    recall  f1-score   support

product_info       0.38      1.00      0.56        10
  size_guide       1.00      0.40      0.57        10
 stock_check       0.00      0.00      0.00        10
store_policy       1.00      0.80      0.89        10
out_of_scope       0.75      0.90      0.82        10

    accuracy                           0.62        50
   macro avg       0.63      0.62      0.57        50
weighted avg       0.63      0.62      0.57        50
```

**System B (Hybrid LLM)**  macro F1 = 0.921
```
              precision    recall  f1-score   support

product_info       0.90      0.90      0.90        10
  size_guide       0.91      1.00      0.95        10
 stock_check       1.00      0.90      0.95        10
store_policy       0.82      0.90      0.86        10
out_of_scope       1.00      0.90      0.95        10

    accuracy                           0.92        50
   macro avg       0.93      0.92      0.92        50
weighted avg       0.93      0.92      0.92        50
```

## Combined

**System A (Rule-based)**  macro F1 = 0.705
```
              precision    recall  f1-score   support

product_info       0.46      0.95      0.62        20
  size_guide       1.00      0.55      0.71        20
 stock_check       1.00      0.25      0.40        20
store_policy       1.00      0.90      0.95        20
out_of_scope       0.76      0.95      0.84        20

    accuracy                           0.72       100
   macro avg       0.84      0.72      0.70       100
weighted avg       0.84      0.72      0.70       100
```

**System B (Hybrid LLM)**  macro F1 = 0.920
```
              precision    recall  f1-score   support

product_info       0.95      0.95      0.95        20
  size_guide       0.83      1.00      0.91        20
 stock_check       1.00      0.80      0.89        20
store_policy       0.86      0.95      0.90        20
out_of_scope       1.00      0.90      0.95        20

    accuracy                           0.92       100
   macro avg       0.93      0.92      0.92       100
weighted avg       0.93      0.92      0.92       100
```

