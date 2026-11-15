# Forecast checks: run of 2026-10-30

Each check looks for a phrase on a page read in this run and compares it with the baseline written into ledger.json. "As on the baseline" means nothing to read; "changed" means a person should read the page before the next review. No check scores a forecast by itself.

## F-001: The AI seat charge disappears for more buyers

- **microsoft/pricing**: looks for `Microsoft 365 Copilot \(add-on\) \$[0-9.]+ user/month`, expected present. Microsoft 365 Copilot is still sold per user. Result: **as on the baseline**.
  - "h2> "> Microsoft Copilot pricing Existing customers New customers Previous Next Microsoft 365 Copilot (add-on) $30.00 user/month, paid yearly Or $31.50 paid monthly (Annual commitment) Pay yearly Pay monthly"
  - "on, and ROI A separate license for a qualifying Microsoft 365 plan is required. Microsoft 365 Copilot (add-on) $30.00 user/month, paid yearly Or $31.50 paid monthly (Annual commitment) Get Microsoft 365 Sign"
- **microsoft/licensing**: looks for `pay[- ]as[- ]you[- ]go|no (seat|licen[cs]e) (fee|charge)`, expected absent. Microsoft's licensing page doesn't offer Copilot without a per-user licence. Result: **as on the baseline**.
- **google/pricing**: looks for `Price is per user/month`, expected present. Workspace, with Gemini in it, is priced per user. Result: **as on the baseline**.
  - "50% off For all users €6.80 €3.40 Feb 13, 2027 - Onwards For all users €6.80 • Price is per user/month and does not include tax €3.40 €6.80 ** / user per month Start a trial Starter"
  - "0% off For all users €13.60 €6.80 Feb 13, 2027 - Onwards For all users €13.60 • Price is per user/month and does not include tax €6.80 €13.60 ** / user per month Start a trial All of"
  - "% off For all users €21.10 €10.55 Feb 13, 2027 - Onwards For all users €21.10 • Price is per user/month and does not include tax €10.55 €21.10 ** / user per month Start a trial All of"
- **anthropic/pricing**: looks for `US\$20/seat/month`, expected present. Claude Enterprise still has a seat price. Result: **as on the baseline**.
  - "Get Enterprise plan Chat with buying specialist Seat price + usage at API rates US$20/seat/month, billed annually, 20 seat minimum. Usage cost scales with model and task. All T"
- **openai/chatgpt-pricing**: looks for `priced per user per month`, expected present. ChatGPT's paid plans are still priced per user. Result: **as on the baseline**.
  - "T is available to everyone. Paid plans (Go, Plus, Business, and Enterprise) are priced per user per month. We offer monthly plans for Go, Plus and Business and annual plans for Business"
- **openai/chatgpt-pricing**: looks for `no (fixed )?seat fee|without a seat`, expected absent. ChatGPT has no seat-free business plan. Result: **as on the baseline**.

## F-002: Outcome pricing leaves the conversation, slowly

- **salesforce/pricing**: looks for `per (outcome|successful|merged|collected|completed|closed)\b|outcome[- ]based`, expected absent. Salesforce's Agentforce pricing has no outcome price beyond Help Agent resolutions (customer service, which doesn't count). Result: **as on the baseline**.
- **salesforce/self-service-pricing**: looks for `\$2 per resolution`, expected present. The Help Agent is still priced per resolution: the excluded customer-service case, kept as context. Result: **as on the baseline**.
  - ") Help Agent Resolutions The out-of-the-box AI service agent for every channel. $2 per resolution $2 per resolution €2 per resolution $2.80 per resolution ¥240 per resolution 20"
  - "utions The out-of-the-box AI service agent for every channel. $2 per resolution $2 per resolution €2 per resolution $2.80 per resolution ¥240 per resolution 20 kr per resolution"
- **workday/flex-credits**: looks for `per (resolution|outcome|successful)|outcome[- ]based`, expected absent. Workday charges credits per action, not per outcome. Result: **as on the baseline**.
- **microsoft/copilot-studio-billing**: looks for `per (resolution|outcome|successful)|outcome[- ]based`, expected absent. Copilot Studio agents are billed in credits, not outcomes. Result: **as on the baseline**.
- **github/plans**: looks for `per (merged|accepted|successful)|outcome[- ]based`, expected absent. GitHub doesn't price Copilot per merged pull request. Result: **as on the baseline**.
- **anthropic/pricing**: looks for `per (resolution|outcome|successful)|outcome[- ]based`, expected absent. Anthropic doesn't price per outcome. Result: **as on the baseline**.

## F-003: Buyers can contest a billed outcome themselves

- **intercom/outcomes-help**: looks for `(dispute|contest|challenge)\w*[^.]{0,80}(outcome|resolution|charge)`, expected absent. Intercom's outcome help has no way to contest a billed outcome. Result: **as on the baseline**.
- **zendesk/managing-usage**: looks for `To dispute the assignment, contact Zendesk Customer Support`, expected present. Zendesk's dispute route still goes through support, which doesn't count. Result: **as on the baseline**.
  - "In some cases, you may disagree with the resolution tier assigned to a ticket. To dispute the assignment, contact Zendesk Customer Support . Powered by Zendesk"
- **zendesk/managing-usage**: looks for `(dispute|contest|challenge|flag)\w*[^.]{0,120}(admin center|dashboard|API|button|select)`, expected absent. Zendesk documents no way to dispute a tier yourself in the product. Result: **as on the baseline**.
- **zendesk/tiers**: looks for `(dispute|contest|challenge)\w*[^.]{0,80}(resolution|charge)`, expected absent. Zendesk's tiers article has no way to contest one. Result: **as on the baseline**.
- **zendesk/terms**: looks for `disputes regarding Automated Resolutions usage`, expected present. The contract's dispute clause, which doesn't count, is still there. Result: **as on the baseline**.
  - "of the new Order Form. All disputes that impact payment obligations (including disputes regarding Automated Resolutions usage or Pay-as-you-go Fees incurred) must be made in good faith and submitted to Zen"
- **hubspot/customer-agent**: looks for `(dispute|contest|challenge)\w*[^.]{0,80}(resolution|charge)`, expected absent. HubSpot's customer-agent page has no way to contest one. Result: **as on the baseline**.

## F-004: The price per resolution falls

- **intercom/pricing**: looks for `\$0\.99 per outcome`, expected present. Intercom still lists $0.99 per outcome. Result: **as on the baseline**.
  - "mate? Use the pricing calculator . How is Fin AI Agent priced? Fin is priced at $0.99 per outcome . An outcome is counted when: A customer confirms their issue is resolved, or T"
  - "helpdesk? Yes. Fin can be used with tools like Salesforce and others. Pricing: $0.99 per outcome Minimum monthly commitment applies (e.g. 50 outcomes) No seat costs No setup, i"
  - "? Yes. Beyond seats, pricing is usage-based for certain features: Fin AI Agent: $0.99 per outcome WhatsApp: Charged per message sent (varies by market/message type) SMS: Charged"
- **zendesk/pricing**: looks for `\$1\.50`, expected present. Zendesk still lists $1.50 (committed automated resolutions). Result: **as on the baseline**.
  - "can handle independently to better align with your business needs. Learn more . $1.50 $1.50 $1.50 Pay-as-you-go resolutions Looking for additional resolutions withou"
  - "ndle independently to better align with your business needs. Learn more . $1.50 $1.50 $1.50 Pay-as-you-go resolutions Looking for additional resolutions without the"
  - "ndependently to better align with your business needs. Learn more . $1.50 $1.50 $1.50 Pay-as-you-go resolutions Looking for additional resolutions without the commit"

