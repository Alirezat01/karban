# Security Specification & Red-Team Payloads — Karban Mobile & Admin Registry

## 1. Core Data Invariants
1. **Strict Multi-Tenant Workspace Isolation**: Every document inside `/users/{userId}/workspace/{docId}` belongs exclusively to `userId` (`ownerId == userId`), and non-owner users can never read, list, or mutate another user's accounting state.
2. **Zero Self-Privilege Escalation (RBAC)**: A regular user registering `/users/{userId}` MUST start with `plan == 'free'` and `accessStatus == 'trial'`. Regular users cannot write `/admins/{adminId}` or modify `plan` / `accessStatus` on their own `/users/{userId}` document.
3. **Immutable Audit & Ownership Fields**: `uid`, `ownerId`, `userId`, `id`, and `createdAt` cannot be changed on update. Timestamps `createdAt` (create) and `updatedAt` (create & update) MUST equal `request.time`.
4. **Payment Approval Integrity & Terminal Locking**: Customers can only create `payment_requests/{requestId}` with `userId == request.auth.uid`, `status == 'pending'`, and `reviewedBy == ''`. Only verified active admins (`isAdmin()`) can approve/reject requests or modify terminal `approved`/`rejected` states.
5. **Verified Identity Enforcement**: Standard writes require `request.auth != null && request.auth.token.email_verified == true`.
6. **Admin Bootstrapping & Registry Governance**: The runtime super-admin (`gaming.alireza.2024@gmail.com`) and approved records in `/admins/{uid}` (`status == 'active'`) hold admin privileges. Additional admins must submit `/admin_requests/{requestId}` with `status == 'pending'` and be explicitly promoted by an active admin.

## 2. The "Dirty Dozen" Red-Team Attack Payloads (All MUST fail with PERMISSION_DENIED)
1. **Self-Admin Spoof**: Non-admin user attempts `setDoc('/admins/' + uid, { uid, role: 'super_admin', status: 'active', ... })`.
2. **Self-Upgrade Plan Attack**: Customer attempts `setDoc('/users/' + uid, { plan: 'founder', accessStatus: 'verified', ... })` on profile creation.
3. **Update-Gap Plan Escalation**: Customer updates `/users/{uid}` with `affectedKeys: ['businessName', 'plan']` trying to slip `plan: 'yearly'` alongside a valid profile edit.
4. **Shadow Ghost Field**: Customer includes `{ ..., isVerified: true }` on `/users/{uid}` create (blocked by `keys().hasOnly(...)`).
5. **Cross-Tenant Workspace Snooping**: User B tries `getDoc('/users/' + userA + '/workspace/main')` or writes into User A's workspace.
6. **Payment Auto-Approval Cheat**: Customer creates `/payment_requests/req1` with `status: 'approved'` and `reviewedBy: uid`.
7. **Other-User Payment Forgery**: Customer A creates `/payment_requests/req2` with `userId: userB`.
8. **Customer Approving Own Payment**: Customer tries `updateDoc('/payment_requests/req1', { status: 'approved', reviewedBy: uid })`.
9. **Terminal State Tampering**: Non-admin tries modifying an already `approved` or `rejected` payment request.
10. **PII Blanket Scraping**: Regular user tries `getDocs(collection(db, 'users'))` (`list` on `/users`).
11. **Timestamp Forgery**: Payload passes client-fabricated `createdAt` or `updatedAt` != `request.time`.
12. **Unverified Email Spoof / ID Poisoning**: User with `email_verified: false` or an oversized/regex-violating document ID (`../bad!id` or >128 chars) attempts write.
