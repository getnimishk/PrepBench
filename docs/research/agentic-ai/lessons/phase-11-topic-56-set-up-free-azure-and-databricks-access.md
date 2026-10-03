# Set up free Azure and Databricks access

**Course:** Agentic AI, from first principles to production · Module 11 Azure and Databricks · lesson 56 of 77 · **about 4 hours** · paper draft for review.  
**Success criterion:** You can run a hello-world model call on Azure and a notebook on Databricks, with a budget alert configured on each.

> Sources (read 2026-10-02 and 2026-10-03; details and gaps in docs/research/agentic-ai): Microsoft Azure 'Free account' page (read 2026-10-03: $200 credit valid for 30 days; free monthly amounts of 20+ services for 12 months; 65+ always-free services; a credit or debit card required for identity verification; spending protection during the trial; moving to pay-as-you-go to keep services after the credit or 30 days end); Microsoft Learn 'Tutorial: Create and manage budgets' (dated 2025-06-26, updated 2025-09-26: a budget notifies, it does not stop resources or consumption; cost data usually arrives in 8 to 24 hours and budgets are evaluated every 24 hours; up to five thresholds and five emails; forecast alerts; action groups; a new subscription may need up to 48 hours before budgets are available; creating budgets needs Contributor or Owner); Databricks documentation 'Free Edition' (updated 2026-09-11: serverless-only, quota-limited, no custom cloud; replaced the Community Edition retired in 2025) and 'Budgets' (updated 2026-09-11: account-level, up to four alert thresholds, list prices in USD, no guaranteed cap; account admin to create; Free Edition not mentioned). NOTHING IN THIS LESSON WAS RUN ON AZURE OR DATABRICKS BY US: we have no accounts there and creating one is a step you must do yourself. Every platform statement is from the vendor page named, as read on the date given, and these products and their limits change quickly. Unverified: whether budgets exist in Databricks Free Edition (the budgets page does not mention it); what your region or employer's policy allows; whether the Azure offer's amounts are the same where you live.

---

## Part 1 · Safety first: what a 'budget' does and does not do

The most expensive mistake in a cloud learning lab is a resource left running. Two facts from the vendors' own pages shape everything below.

**A budget alert is a smoke alarm, not a sprinkler.** Microsoft's budget tutorial says it directly: when a threshold is exceeded, notifications are triggered, but 'resources aren't affected, and your consumption isn't stopped.' Cost and usage data typically arrive 8 to 24 hours late and budgets are evaluated every 24 hours, so an alert can arrive a day after the spending happened. Databricks says the same in its own words: budgets do not guarantee spending caps, the estimates are near real-time, and the actual cost may differ from the threshold (blocking is an optional extra through a gateway budget, which we did not read in detail).

So you need layers:

1. **A hard limit if the offer has one.** Azure's free account says it includes spending protection during the trial, so your card is not charged; check on the sign-up page what happens when credit ends (you must move to pay-as-you-go to keep going).
2. **A budget with alerts** at several thresholds (for example 50, 80 and 100 percent, plus a forecast alert), to more than one email address.
3. **A habit of tearing things down.** Delete or stop every resource when you finish a session. The cheapest resource is the one that no longer exists.
4. **Small quotas and sizes.** Choose the smallest models, the lowest throughput and no autoscale ceiling you do not understand.
5. **A calendar reminder to look.** Check the cost view the day after every lab session and weekly after that.

**Worked example**

Fictional. A learner leaves a deployed model endpoint and a search service running over a long weekend. A budget alert at 80 percent arrives on Monday, a day after the cost accrued. The spending protection of the free offer caps the loss; on a paid subscription it would not. The next lab ends with a checklist item: 'delete the resource group'.

**Common mistake**

Setting a budget and assuming it protects you. It reports; it does not stop.

**Check yourself.** Does an Azure budget stop resources when the threshold is reached, and how late can an alert be?

<details><summary>Model answer (write yours first)</summary>

No. It notifies only; resources keep running and consumption continues. Cost data arrives in 8 to 24 hours and budgets are evaluated every 24 hours, so alerts can lag by a day.

</details>

---

## Part 2 · Azure: free account, budget and least-privilege access

What the page says about the **free account** (read 2026-10-03): a **$200 credit valid for 30 days**, free monthly amounts of 20-plus popular services for 12 months and 65-plus always-free services. A credit or debit card (not prepaid) is required for identity verification; the page says nothing is charged at sign-up and a temporary $1 authorisation may appear and be reversed. When the credit or 30 days end you move to pay-as-you-go to keep using services, keeping the always-free ones and the free monthly amounts. **You must create the account yourself.** We cannot and will not enter your details, and you should never share your card or credentials with an assistant.

Steps, in order:

1. Create the account on Microsoft's official site, using a personal or work account as your situation requires. Check your employer's policy first if you use a work identity.
2. **Create a separate resource group for the course** so you can delete everything in one action.
3. **Create a budget** on the subscription (or resource group): choose a small monthly amount, add actual-cost thresholds and one forecast threshold, and add two email addresses. Budgets support up to five thresholds and five emails; you need Owner or Contributor to create them, and a brand-new subscription may need up to 48 hours before budgets are available.
4. **Use least privilege day to day.** The account that created the subscription is an owner. For routine work create or use a user with a narrower role (for example Contributor on the course resource group only), and use the owner role only for setup. Use a managed identity for anything that runs code (lesson 51).
5. **Do the hello world:** deploy the smallest suitable model in the model catalog and send one request (lesson 57 describes the pieces), note the cost it generates, then delete the deployment.
6. **Record the evidence:** a screenshot or text of the budget with its thresholds, the request and response (with any key removed), and the cost view the next day.

**Worked example**

Fictional budget: $20 a month on the course resource group, actual-cost alerts at 50, 80 and 100 percent, a forecast alert at 100 percent, two emails. Next-day check: the cost view shows $0.31 from the hello-world call, which matches expectation.

**Common mistake**

Working as subscription Owner all the time. A leaked key or a mistaken command then has the widest possible reach; use a narrower role for routine work.

**Check yourself.** Name three things you set up before deploying anything on Azure, and one thing you do after every session.

<details><summary>Model answer (write yours first)</summary>

A separate resource group, a budget with several thresholds and a forecast alert to two emails, and a least-privilege role for daily work. After each session: delete or stop what you created and check the next day's cost.

</details>

---

## Part 3 · Databricks: Free Edition and its budget

**Databricks Free Edition** (page updated 2026-09-11) is described as a no-cost version for students, educators, hobbyists and anyone learning or experimenting. It gives a **serverless workspace with built-in storage**, and the page lists features such as building AI applications, Genie dashboards, Lakeflow pipelines and in-product coding help. It is a **serverless-only, quota-limited** environment with **no custom cloud deployment**, and it replaced the Community Edition, which was retired in 2025. It has 'many of the same features' as the full platform 'with some limitations', so check each feature you plan to use. Because it is quota-limited, the main protection against surprise cost is the quota itself: you cannot spend what you do not have access to.

**Budgets on Databricks** (page updated 2026-09-11) are account-level: you can track account-wide spending or filter by workspace, resource type and custom tags; they support up to four alert thresholds with email notifications, use list prices in USD, and, as noted, do not guarantee a cap. You must be an account admin to create them. **The budgets page does not mention Free Edition**, so we do not know whether a budget can be configured there. Your criterion asks for a budget alert on each platform: if Free Edition has no budgets, say so in your evidence, show the quota instead, and configure a budget if and when you use a paid workspace.

Steps:

1. Sign up for Free Edition from Databricks' official page, yourself.
2. Create a notebook, attach it to serverless compute, run a one-line cell, and save the output.
3. Open the account or workspace settings and note what quotas and budget options you can see. Record what you found, and what you could not find.
4. Create a small Delta table in a catalog you own (lesson 32 and lesson 58 use it) and note who owns it.
5. Stop anything running when you finish.

**Worked example**

Fictional evidence note: 'Free Edition signed up 2026-10-05; notebook ran `select 1`; serverless only; the Budgets page is not visible to my user, so I could not create a budget (quota is the limit). Paid-workspace budget configuration deferred; documented the steps from the Databricks budgets page dated 2026-09-11.'

**Common mistake**

Writing down a budget you did not create. Evidence says what you saw, including 'this option was not available to me'.

**Check yourself.** What are two limits of Databricks Free Edition per its docs, and why is a missing budget feature there not a safety problem?

<details><summary>Model answer (write yours first)</summary>

It is serverless-only and quota-limited with no custom cloud deployment. The quota itself bounds what can be used, so the protection comes from the limit; confirm in your own account what is available.

</details>

---

## Do it: lab

1. Create a free Azure account yourself on Microsoft's official site. Do not share card details or credentials with anyone, including an assistant. Note the offer's credit, duration and what happens at the end, from the sign-up page, with the date.
2. Create a resource group for the course and a budget on it (or the subscription) with actual-cost thresholds and a forecast threshold to two emails. Save evidence of the budget.
3. Set up least-privilege daily access (a narrower role than Owner), and write down which role you use for what.
4. Run a hello-world model call on Azure with the smallest suitable model. Record the request and response without any key, then check the cost view the next day and delete the deployment.
5. Create a Databricks Free Edition workspace yourself, run a notebook on serverless compute, and record what quota and budget options you can see (and any that you cannot).
6. Write a one-page 'teardown and cost' routine: what you delete after every session, when you check costs, and who gets the alert emails.

**Done when:** you can run a hello-world model call on Azure and a notebook on Databricks, with a budget alert configured on Azure and either a budget or a documented quota limit on Databricks, with saved evidence and a teardown routine.

---

## Interview check

**Question.** How do you let a team experiment with cloud AI services without risking a surprise bill?

<details><summary>A strong answer has this shape</summary>

1. Use free or credit-limited offers with spending protection where they exist, and understand what ends them.
2. Give each person a separate resource group or workspace and the least role that works; owners only for setup.
3. Budgets with several thresholds and forecast alerts to more than one person, remembering that budgets notify and do not stop spending, and alerts lag by up to a day.
4. Small quotas and sizes, a rule to delete resources after each session, and a next-day cost check.
5. For anything beyond learning, a real hard control (quota, policy, or an automated action on alert) and an owner for the account.

</details>

---

## Evidence to keep

Keep the evidence: sign-up offer terms with the date, the budget with thresholds, the role design, the hello-world request and response (key removed), the Databricks notebook and quota notes, and the teardown routine.

---
