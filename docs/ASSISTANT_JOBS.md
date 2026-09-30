# Assistant job create

A trusted assistant can create one Treemarkables job through the same handler the job card uses (`POST /api/jobs`, the path behind ServiceJobForm and GlobalJobCard). There is no second job table or create model.

The action is scoped to Treemarkables (`a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2`). A caller cannot choose another business.

## Auth

`Authorization: Bearer <secret>`

The secret is the server environment variable `INFLOW_ASSISTANT_JOB_SECRET`. Set it on the host. Do not commit the value. If the variable is unset, every call is refused and nothing is written.

## Request

`POST /api/assistant/jobs`

| Field | Required | Meaning |
| --- | --- | --- |
| `customerName` | yes, unless `customerId` is set | Name to find or to store. Stored exactly as sent when the customer is new. |
| `customerId` | no | Use this existing Treemarkables customer. |
| `customerEmail` | no | Extra match signal. Not a spelling correction. |
| `customerPhone` | no | Extra match signal. Digits are compared as given, not rewritten to another number. |
| `newCustomer` | no | Boolean. `true` means do not attach this call to someone already on file. If anyone matches, the call returns those customers and does not write. |
| `address` | yes | Job address. Stored exactly as sent. |
| `description` | yes | Job description. Stored exactly as sent. |
| `price` | yes | NZD **excluding GST**. The figure the job card shows. Up to two decimal places. |
| `confirm` | no | Must be the JSON boolean `true` to write. `false`, a missing field, and the string `"true"` do not write. |

`businessId` is ignored when it is the Treemarkables id. Any other value is refused.

## Confirm before anything is written

Call once without `confirm` (or with `confirm` not exactly `true`). The response is a readback and nothing is saved:

- `readback.customer` — the existing customer, or the new name that would be stored
- `readback.address`
- `readback.description`
- `readback.price` — NZD exc. GST

Send the same fields again with `"confirm": true` to create. The create goes through `POST /api/jobs`.

If more than one existing customer matches the name, phone, or email, the response lists `matches` and does not create, even when `confirm` is true. Pick one with `customerId`, or change the details so only one customer (or none) matches.

A phone or email that belongs to a customer with a different name does not replace the spelled name. The match is returned and nothing is written.

## Result

A successful create returns the job from `POST /api/jobs` (`data`), `wrote: true`, and `link` (`{APP_URL}/dispatch?job={id}`). The job is a quote, with one exc-GST line for the description and price, which is how the job card reads a price.
