# Cavite Institute PMS — QA / Defense Test Accounts

Use these credentials to log in and test each role. Run `npm run seed:test-accounts` from the `backend` folder to create missing accounts (idempotent).

---

## Administrator

```
Role: Administrator
Username: admin
Password: admin123
Email: admin@caviteinstitute.edu
Assigned: — (full system access)
```

---

## Property Manager

```
Role: Property Manager
Username: pm_test
Password: pm123456
Email: pm_test@caviteinstitute.edu
Assigned: — (all departments & locations)
```

---

## Department Custodian

```
Role: Department Custodian
Username: deptcust_test
Password: dept123456
Email: deptcust_test@caviteinstitute.edu
Assigned: Information Technology Department (IT)
```

---

## Laboratory Custodian

```
Role: Laboratory Custodian
Username: labcust_test
Password: lab123456
Email: labcust_test@caviteinstitute.edu
Assigned: ICT Laboratory
```

---

## Employee (Staff)

```
Role: Employee (Staff)
Username: staff
Password: staff123
Email: staff@caviteinstitute.edu
Assigned: — (employee / own borrow requests only)
```

---

## Quick reference table

| Role | Username | Password | Email |
|------|----------|----------|-------|
| Administrator | `admin` | `admin123` | admin@caviteinstitute.edu |
| Property Manager | `pm_test` | `pm123456` | pm_test@caviteinstitute.edu |
| Department Custodian | `deptcust_test` | `dept123456` | deptcust_test@caviteinstitute.edu |
| Laboratory Custodian | `labcust_test` | `lab123456` | labcust_test@caviteinstitute.edu |
| Employee (Staff) | `staff` | `staff123` | staff@caviteinstitute.edu |

**Note:** `admin` and `staff` are created by the main seed (`npm run seed`). The three `*_test` accounts are created by `npm run seed:test-accounts`.

---

## Sample data for QA / defense

After seeding accounts, run sample data from the `backend` folder:

```bash
npm run seed:sample-data
```

See [SAMPLE_DATA.md](./SAMPLE_DATA.md) for inventory, borrow, return, transfer, maintenance, and disposal example records (5+ each, varied statuses).
