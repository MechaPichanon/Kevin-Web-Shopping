# Kevin Web Shopping

Thai clothing e-commerce platform (thesis project) with an AI product chatbot and image search.

## Language

**Verified Purchase**:
A badge on a review, not a gate on submission — any logged-in user may review a product, but if the reviewer has a paid order containing that product, the review links to it (`reviews.order_id`) and is marked verified. Verified reviews auto-publish; unverified ones wait for moderation.
_Avoid_: Confirmed order, eligible reviewer

**Role**:
Every user has exactly one: **Customer** (default — browse, purchase, review), **Staff** (also manage the product catalog and orders, but not user accounts or role assignment), or **Admin** (full access, including user management and granting roles). Staff cannot promote themselves or anyone else.
_Avoid_: Permission level, access tier
