# Addresses API

> Customer address management

**File:** `convex/customer.ts` → `backend/addresses.ts`  
**Client:** VelShop  
**Auth:** Required (customer)

## Endpoints

| Action | Purpose |
|--------|---------|
| `myAddresses()` | List user addresses |
| `saveAddress(data)` | Create or update address |
| `deleteAddressAction(id)` | Delete address |

## Address Fields

| Field | Required | Notes |
|-------|----------|-------|
| recipientName | ✅ | Recipient full name |
| phone | ✅ | Contact phone |
| addressLine1 | ✅ | Street address |
| addressLine2 | ❌ | Apartment, suite, etc. |
| city | ✅ | City/district |
| province | ✅ | Province/state |
| postalCode | ✅ | Postal code |
| country | ❌ | Defaults to "TH" |
| latitude | ❌ | GPS coordinate |
| longitude | ❌ | GPS coordinate |
| isDefault | ❌ | Mark as default |

## GPS Coordinates

If the backend requires GPS (`ADDRESS_GPS_REQUIRED` error), the client must provide latitude/longitude. This is enforced for delivery accuracy.

## Security

- Users can only access their own addresses
- Address ownership verified server-side
- Deletion checks for active orders using the address
