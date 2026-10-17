import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// People a learner keeps in touch with for their job search (career-outreach): third parties'
// details recorded by the learner, private to them. Times are epoch ms; application_id is one of
// the owner's job_applications or null. No foreign keys: release.sh only applies additive SQL.
export const careerContacts = sqliteTable(
  'career_contacts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    company: text('company').notNull().default(''),
    role: text('role').notNull().default(''),
    howMet: text('how_met').notNull().default(''),
    url: text('url').notNull().default(''),
    lastContactAt: integer('last_contact_at'),
    nextAt: integer('next_at'),
    notes: text('notes').notNull().default(''),
    applicationId: text('application_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('career_contacts_user').on(t.userId, t.updatedAt)],
);
