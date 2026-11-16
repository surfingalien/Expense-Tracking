-- Per-user data (Clerk), integer cents for money, income and recurring expenses.
-- Existing rows keep their data: amounts/budgets are converted to cents, and
-- rows get userId = NULL until the first user signs in and claims them.

-- Category: per-user names, budget in cents
DROP INDEX "Category_name_key";
ALTER TABLE "Category" ADD COLUMN "userId" TEXT;
ALTER TABLE "Category" ADD COLUMN "budgetCents" INTEGER;
UPDATE "Category" SET "budgetCents" = ROUND("budget" * 100)::INTEGER WHERE "budget" IS NOT NULL;
ALTER TABLE "Category" DROP COLUMN "budget";
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- Expense: amount in cents, owner, link to recurring rule
ALTER TABLE "Expense" ADD COLUMN "userId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "recurringId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "amountCents" INTEGER;
UPDATE "Expense" SET "amountCents" = ROUND("amount" * 100)::INTEGER;
ALTER TABLE "Expense" ALTER COLUMN "amountCents" SET NOT NULL;
ALTER TABLE "Expense" DROP COLUMN "amount";
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Income_userId_date_idx" ON "Income"("userId", "date");

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "merchant" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "nextDate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
