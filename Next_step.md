---
  The Core Problem DeepReader Should Solve

  Most reading apps optimize for consumption — pages turned, books finished. But the science is clear: reading is not learning. The
  feeling of understanding while reading is largely the fluency illusion — the text feels familiar, so you feel like you know it. Then two
   weeks later, it's gone.

  DeepReader should be the app that closes the gap between reading and retaining. Every feature should serve that single goal.

  Here's what I'd build, organized by the science behind each feature:

  ---
  1. Chapter Recall Gate (Testing Effect + Generation Effect)

  The science: Retrieving information from memory strengthens it far more than re-reading (Roediger & Karpicke, 2006). And information you
   generate yourself is remembered better than information you passively receive.

  The feature: When the reader finishes a chapter (or a significant section), before they can move to the next one, show a brief
  free-recall screen:

  ▎ "What were the key ideas in this chapter? Write what you remember — don't look back."

  A blank textarea. No hints. No multiple choice. Just retrieval. This is uncomfortable on purpose — it's a desirable difficulty (Bjork,
  1994). The effort of trying to recall is what cements the memory.

  Store these summaries as special vault notes linked to the chapter. During later reviews, occasionally surface them: "You wrote this
  summary 3 weeks ago — would you revise it now?"

  This single feature would do more for retention than any amount of highlighting.

  ---
  2. Confidence Calibration (Metacognition)

  The science: One of the most robust findings in learning research is that people are terrible at judging what they know. The illusion of
   competence means you feel confident about material you can't actually retrieve. Good learners are well-calibrated — they know what they
   don't know.

  The feature: During SRS review, before revealing the answer, ask the user to rate their confidence (1–5). After revealing, they rate
  their actual performance (as already exists). Track the delta over time.

  Then show a calibration curve: a graph where the x-axis is "how sure you were" and the y-axis is "how often you were actually right." A
  perfectly calibrated learner shows a diagonal line. Most people show massive overconfidence in the middle range.

  This makes the invisible process of self-deception visible. No AI needed — just arithmetic.

  ---
  3. The Collector's Fallacy Shield

  The bias: People hoard highlights and annotations. The act of highlighting feels productive — you're "engaging with the text." But
  highlighting is one of the least effective study strategies (Dunlosky et al., 2013). It's shallow processing that creates the illusion
  of effort without actual encoding.

  The feature: Track the lifecycle of every annotation:
  - Orphaned — highlighted but never annotated with a note
  - Noted — has a margin note but never promoted to a card
  - Promoted — became a concept card
  - Reviewed — card has been through at least one SRS cycle
  - Mature — card has survived multiple successful reviews

  Show this as a dashboard at the session harvest screen. Not punitive, just honest:

  ▎ "This session: 14 highlights, 5 notes, 2 cards created. Your cards from last week have 73% retention."

  The implicit message: fewer, deeper annotations beat more, shallower ones.

  ---
  4. Concept Graph (Schema Theory)

  The science: New knowledge integrates into long-term memory by connecting to existing knowledge structures — schemas. Isolated facts are
   fragile; networked facts are resilient. This is why experts learn faster in their domain: every new fact has dozens of hooks to attach
  to.

  The feature: You already have [[wiki-links]] in card bodies. Render them as an interactive force-directed graph. Each node is a concept
  card, each edge is a wiki-link. Cluster by book/topic.

  Key interactions:
  - Orphan detection — cards with zero connections are flagged as potentially fragile knowledge
  - Bridge concepts — cards that connect two otherwise separate clusters are highlighted as high-value
  - Growth over time — animate how the graph grew week-by-week

  This gives the reader a tangible representation of their knowledge structure. It also creates a natural motivation to connect new ideas
  to existing ones, which is exactly what deep processing requires.

  ---
  5. Interleaved Review (Interleaving Effect)

  The science: Reviewing topics in mixed order (interleaving) produces significantly better long-term retention than reviewing one topic
  at a time (blocking), even though it feels harder and slower (Rohrer & Taylor, 2007). The difficulty is the point.

  The feature: The current review queue is sorted by due date. Add an interleaving mode that deliberately mixes cards from different books
   and topics in a single review session. The user should be able to toggle this, but it should be the default — with a brief explanation
  of why it feels harder but works better.

  ---
  6. Progressive Retrieval Difficulty (Desirable Difficulties)

  The science: As a memory gets stronger, you need harder retrieval challenges to continue strengthening it. A cloze deletion where you
  fill in one word is easier than explaining a concept from scratch. Easy reviews maintain memory; hard reviews grow it.

  The feature: Card reviews escalate in difficulty based on maturity:

  ┌──────────────────────────┬────────────────────────────────────────────────────────────┐
  │         Maturity         │                        Review Mode                         │
  ├──────────────────────────┼────────────────────────────────────────────────────────────┤
  │ New card                 │ Show body with cloze, fill in blanks                       │
  ├──────────────────────────┼────────────────────────────────────────────────────────────┤
  │ Young (interval < 7d)    │ Show title only, recall the body                           │
  ├──────────────────────────┼────────────────────────────────────────────────────────────┤
  │ Mature (interval > 21d)  │ Show source context, explain the concept in your own words │
  ├──────────────────────────┼────────────────────────────────────────────────────────────┤
  │ Veteran (interval > 60d) │ "Teach this concept to someone" — write an explanation     │
  └──────────────────────────┴────────────────────────────────────────────────────────────┘

  This prevents the common failure mode where mature cards become mindless pattern-matching ("I recognize this card, it's X") rather than
  genuine knowledge.

  ---
  7. Reading Velocity vs. Retention Dashboard

  The science: Speed of reading is inversely correlated with depth of processing. There's nothing wrong with reading fast when the
  material is familiar, but readers consistently overestimate their comprehension of fast-read material.

  The feature: Track time-per-page at the session level. Cross-reference with card performance:

  ▎ "Chapters you spent > 3 min/page on: 82% card retention. Chapters you spent < 1 min/page on: 41% card retention."

  No prescriptive "slow down!" messages. Just the data, presented honestly. Let the reader calibrate. This respects user autonomy while
  fighting the speed-reading bias.

  ---
  8. Forgetting Curve Visualization

  The science: Ebbinghaus showed that memory decays exponentially without reinforcement. SM-2 models this implicitly, but the user never
  sees it.

  The feature: For each card, show a small sparkline of its predicted retention probability over time, with dots at each actual review
  point. When you open a card's detail view, show:

  - The exponential decay curve
  - How each successful review "reset" the curve with a gentler slope
  - The predicted retention right now (e.g., "~65% chance you'd recall this today")

  Making forgetting visible is powerful. It transforms SRS from a chore into a fight against a visible enemy.

  ---
  9. Honest Rest, Not Streak Anxiety

  The science: Distributed practice (studying in multiple shorter sessions across days) vastly outperforms massed practice (cramming). But
   many apps use streak mechanics that create anxiety around missing days — a dark pattern that optimizes for engagement, not learning.

  The anti-pattern to avoid: Never show "You'll lose your 30-day streak!" That's operant conditioning designed to create compulsive
  behavior, not learning.

  The feature instead:
  - After ~45 minutes of reading, a gentle note: "Research shows retention peaks around 45 minutes. Good time for a break?"
  - Track consistency (days active per week) but frame it as a trend line, not a streak
  - Celebrate quality metrics ("Your average card maturity increased this week") rather than quantity metrics ("You reviewed 50 cards!")
  - If the user misses a day, say nothing. If they miss a week, welcome them back with zero guilt: "You have 12 cards due. Want to start
  with the 5 most important?"

  ---
  10. Card Retirement & Leech Detection

  The science: Some cards are genuinely learned and don't need further review (wasting cognitive effort). Other cards are leeches — they
  fail repeatedly no matter how many times you review them. Leeches usually signal a poorly formed card, not a memory problem.

  The feature:
  - Retirement: Cards reviewed successfully 8+ times with interval > 90 days get flagged as "mature — consider retiring." Retired cards
  get one surprise review per year.
  - Leech detection: Cards that have been rated 1-2 more than 4 times get flagged: "This card keeps failing. The problem might be the
  card, not your memory. Consider rewriting it." Link to guidelines on what makes a good card (atomic, one idea, clear question).

  ---
  Let's build them all.