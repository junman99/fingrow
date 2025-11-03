# AI Assistant Feature Reference

## Tier Comparison

### Free Tier (Default)
**Usage Limits:**
- ✅ 10 AI messages per day
- ✅ 5 messages per hour
- ⚠️ Max 500 tokens per response (concise answers)

**Features:**
- ✅ Basic spending insights
  - "How much did I spend on food this month?"
  - "What's my top spending category?"
- ✅ Portfolio queries
  - "What's my portfolio value?"
  - "How is my portfolio performing?"
- ✅ Transaction logging
  - "I spent $50 at Target on groceries"
  - Natural language to structured data
- ✅ 2-message conversation memory
- ✅ Response time: Standard (~2-3 seconds)

**Limitations:**
- ❌ No advanced trend analysis
- ❌ No predictive insights
- ❌ No monthly financial summaries
- ❌ Limited conversation context

---

### Premium Tier
**Usage Limits:**
- ✅ **50 AI messages per day** (5x more)
- ✅ **20 messages per hour** (4x more)
- ✅ **Max 1000 tokens per response** (detailed answers)

**Features:**
- ✅ **Everything in Free tier**
- ✅ **Advanced insights**
  - "How does my Q4 spending compare to Q3?"
  - "Which categories am I overspending in?"
- ✅ **Trend analysis**
  - "Am I on track to hit my savings goal?"
  - "How has my net worth changed over 6 months?"
- ✅ **Portfolio analytics**
  - "Which stocks performed best this month?"
  - "Show me my investment history for AMD"
- ✅ **5-message conversation memory** (better context)
- ✅ **Priority processing** (~1-2 seconds)
- ✅ **Monthly financial summary** (auto-generated)

---

## Testing Mode

During development, all limits are disabled:
- Unlimited messages per day/hour
- 2000 token responses
- 10-message conversation memory
- All premium features enabled

**To toggle:** Edit `/src/config/ai.ts` → `TESTING_MODE: true/false`

---

## Privacy & Data Handling

### What Gets Sent to Claude AI

**✅ Sent (Aggregated Summaries Only):**
- Monthly/category spending totals
- Portfolio values and performance metrics
- Net worth calculations
- User's question text
- Last 2-5 messages for conversation context

**❌ Never Sent:**
- Individual transaction details
- Account numbers or passwords
- Raw transaction lists
- Merchant names (except in transaction logging)
- Personal identifiers
- Payment methods

### Example of Data Minimization

**User asks:** "How much did I spend on restaurants in the past 3 months?"

**What we send to Claude:**
```
User spent $340 on restaurants in September, $380 in October,
and $420 in November. Total: $1,140. Monthly budget is $400.
```

**What we DON'T send:**
```
❌ 47 individual transaction records
❌ Specific restaurant names
❌ Exact dates and times
❌ Payment card details
```

### Data Flow

```
1. User asks question
   ↓
2. Local intent detection (on device)
   ↓
3. Local database query (on device)
   ↓
4. Aggregate results (on device)
   ↓
5. Send ONLY summary to Claude API
   ↓
6. Receive formatted response
   ↓
7. Display to user
```

### Caching Strategy

**Local Device Cache:**
- Common queries cached for 1 hour
- No API call needed for repeated questions
- E.g., "What's my net worth?" cached locally

**Claude Prompt Caching:**
- System prompt cached automatically
- Saves 70% on repeated queries within 5 minutes
- Reduces cost significantly

### Data Retention

- 🕐 **Claude AI**: Messages processed in real-time, not stored (per Anthropic policy)
- 🕐 **Local cache**: 1 hour TTL, then deleted
- 🕐 **Conversation history**: Deleted after session or 24 hours
- 📊 **Usage metrics**: Anonymous counts only (for rate limiting)

---

## Cost Estimation

### Model: Claude 3.5 Haiku
- Input: $0.80 per million tokens
- Output: $4.00 per million tokens

### Per-Query Cost

**Average query:**
- Input: 1000 tokens (context + question)
- Output: 500 tokens (response)
- Cost: (1000 × $0.80 + 500 × $4) / 1M = **$0.0028 per query**

**With caching (70% savings on input):**
- Input: 300 tokens (after cache)
- Output: 500 tokens
- Cost: **$0.0022 per query**

### Monthly Cost Estimates

**Free tier user:**
- 10 queries/day × 30 days = 300 queries
- Cost: **$0.66 - $0.84/month**

**Premium tier user:**
- 50 queries/day × 30 days = 1,500 queries
- Cost: **$3.30 - $4.20/month**

**1000 active users (10% premium):**
- 900 free + 100 premium
- Cost: **~$600 - $1,000/month**

---

## Legal & Compliance

### Third-Party Data Processing

**Anthropic Claude API:**
- SOC 2 Type II certified
- GDPR compliant
- Does NOT train on user data
- Messages not retained after processing
- Privacy policy: https://www.anthropic.com/privacy

### User Rights

Users can:
- View all AI interactions (Settings → AI History)
- Clear conversation history anytime
- Disable AI assistant completely
- Withdraw consent at any time

### Consent

By using the AI assistant, users consent to:
1. Sending aggregated financial summaries to Anthropic
2. Temporary caching for performance
3. Anonymous usage analytics

---

## Settings Integration

**Location:** Settings screen → "AI Assistant" section

**UI Features:**
- Toggle between Free and Premium tiers (for testing)
- Visual comparison of features
- Link to privacy disclosure
- Shows current tier with checkmark
- Haptic feedback on selection

**Code:** See `/src/screens/Settings.tsx` line 577

---

## Next Steps for Implementation

1. ✅ AI configuration created (`/src/config/ai.ts`)
2. ✅ Settings UI added with tier selector
3. ⏳ Build local intent classifier
4. ⏳ Build data aggregation functions
5. ⏳ Create conversation manager
6. ⏳ Build Claude API wrapper
7. ⏳ Wire up AI Assistant screen
8. ⏳ Create transaction confirmation UI
9. ⏳ Update AIPrivacyInfo screen with disclosure

---

## Questions to Answer

**Q: How do we handle "How much did I spend on coffee for the past 3 months?" if we only send last 30 days?**

A: We don't! We query the local database for the full 3 months, aggregate it on-device, and send ONLY the summary:
```
Local query: SELECT month, SUM(amount) FROM transactions
WHERE category LIKE '%coffee%' AND date >= '2025-08'
GROUP BY month

Result: Aug: $145, Sep: $167, Oct: $98

Send to Claude: "User spent $145 in Aug, $167 in Sep, $98 in Oct on coffee"
```

**Q: What if user asks "Have I ever invested in AMD? What price?"**

A: Same approach - query all AMD transactions locally, send summary:
```
Local query: SELECT * FROM portfolio_transactions WHERE symbol = 'AMD'

Send to Claude: "User bought 10 shares of AMD at $145.20 on Mar 15,
bought 5 more at $152.80 on Aug 22. Sold 5 shares at $165.50 on Oct 10.
Currently holds 10 shares."
```

**Q: Where is data cached?**

A: Three layers:
1. **SQLite local cache** (device) - fastest, most private
2. **Claude prompt cache** (API) - automatic, saves 70% on repeated queries
3. **Redis** (optional, future) - for shared insights across users

---

## Contact

For questions or privacy concerns: privacy@fingrow.app
