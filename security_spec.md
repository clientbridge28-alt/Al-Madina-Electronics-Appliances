# Security Specification & Payload-First TDD — Al-Madina Electronics & Appliances ERP

## 1. Core Security & Data Invariants
1. **Verified Identity Gate**: Every business read/write operation requires `request.auth != null` AND `request.auth.token.email_verified == true`. Anonymous or unverified accounts are denied.
2. **Owner Authority & RBAC Enforcement**:
   - The showroom Owner (`clientbridge28@gmail.com` when `email_verified == true`, or listed in `/admins/{uid}`, or active non-suspended `/users/{uid}` with `role == 'Owner'`) holds master administrative authority.
   - Staff accounts MUST exist in `/users/{uid}` with `active == true && suspended == false` and hold the exact module permission (`VIEW`, `CREATE`, `EDIT`, `DELETE`, `EXPORT`, `APPROVE`, `MANAGE`) required for the collection/action.
   - Users can NEVER modify their own `role`, `permissions`, `active`, `suspended`, `sessionVersion`, or `orgId` fields (Zero Privilege Escalation).
3. **PII Isolation**:
   - `/users/{uid}` holds PII (`email`, `phone`) and authorization flags (`role`, `permissions`, `suspended`). Only the Owner or the user themselves (`request.auth.uid == uid`) can `get` `/users/{uid}`. `list` on `/users` is restricted to Owner-only or `resource.data.uid == request.auth.uid`.
   - Non-PII staff display info (`uid`, `name`, `role`, `active`, `orgId`) is stored separately in `/users_public/{uid}`.
4. **Financial & Audit Immutability**:
   - Posted double-entry `vouchers` and `auditLogs` are immutable (`allow update, delete: if false;` on `auditLogs`, and posted `vouchers` can only be marked `Cancelled` via reversal by authorized Accountant/Owner, never deleted or altered in amount/entries).
   - Every `Voucher` must contain balanced debit and credit entries with positive totals.
5. **Path Hardening & Resource Bounds**:
   - Every single-doc path variable is validated with `isValidId()` (`^[a-zA-Z0-9_\\-]+$`, length `<= 128`).
   - Every string enforces `.size()`, every array enforces bounded `.size()`, and every write enforces `keys().hasOnly(...)` & `keys().hasAll(...)` to prevent ghost/shadow fields.
6. **Temporal Integrity**:
   - Server timestamps (`createdAtServer`, `updatedAtServer`) use `request.time` on create/update where enforced, and immutable `createdByUid` / `createdAt` cannot be altered on update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Unverified Email Spoof**: Attacker signs in with `email: "clientbridge28@gmail.com"` but `email_verified: false`, attempts to read `/users` or write `/admins/attacker`.
2. **Self-Privilege Escalation (Create)**: New user registers `/users/{uid}` with `role: "Owner"` and `permissions: { admin: ["MANAGE"] }`.
3. **Self-Privilege Escalation (Update)**: Existing `Cashier` updates `/users/{uid}` changing `role` to `"Owner"` or adding `"MANAGE"` to `permissions`.
4. **Ghost / Shadow Field Injection**: Authenticated user posts a `Customer` or `Product` payload containing extra unexpected field `isVerified: true` or `adminOverride: true`.
5. **PII Scraping**: `Cashier` attempts `get(/users/otherStaffUid)` or `list(/users)` to harvest emails, phones, and permission structures of other staff.
6. **Suspended User Write**: User with `/users/{uid}.suspended == true` attempts to create a `SalesInvoice` or read `/customers`.
7. **Audit Log Tampering**: Even an `Owner` attempts `update` or `delete` on `/auditLogs/{logId}` to erase audit history.
8. **Posted Voucher Alteration / Deletion**: Staff attempts `delete` or amount modification on a posted `/vouchers/{voucherId}`.
9. **ID Poisoning / Denial-of-Wallet**: Attacker attempts to write document with 1.5KB junk ID or a 200KB string inside `product.name`.
10. **Cross-Author Impersonation**: Staff creates a `SalesInvoice` or `StaffTask` setting `createdByUid` to someone else's UID.
11. **Non-Owner Admin Mutation**: A `Manager` attempts to write `/roles/{roleId}`, `/admins/{uid}`, `/backups/{id}`, or update `/settings/showroom`.
12. **Blanket Unscoped List / Unauthenticated Read**: Unauthenticated client attempts `list(/customers)` or `get(/sales/INV-1001)`.
