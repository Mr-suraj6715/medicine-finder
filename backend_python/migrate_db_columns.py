import os
import sys
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import engine

def migrate():
    print("Running database column migrations...")
    with engine.connect() as conn:
        # Address table columns
        address_columns = [
            ('fullName', 'VARCHAR'),
            ('phone', 'VARCHAR'),
            ('houseNumber', 'VARCHAR'),
            ('street', 'VARCHAR'),
            ('landmark', 'VARCHAR'),
            ('city', 'VARCHAR'),
            ('state', 'VARCHAR'),
            ('pincode', 'VARCHAR'),
            ('address', 'VARCHAR'),
            ('latitude', 'DOUBLE PRECISION'),
            ('longitude', 'DOUBLE PRECISION'),
            ('isDefault', 'BOOLEAN DEFAULT FALSE'),
            ('createdAt', 'VARCHAR'),
            ('updatedAt', 'VARCHAR')
        ]
        for col_name, col_type in address_columns:
            try:
                conn.execute(text(f'ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "{col_name}" {col_type};'))
                print(f"✓ Ensured Address.{col_name}")
            except Exception as e:
                print(f"Note on Address.{col_name}: {e}")

        # User table columns
        user_columns = [
            ('loyaltyPoints', 'INTEGER DEFAULT 0'),
            ('riderRating', 'DOUBLE PRECISION DEFAULT 3.0'),
            ('riderLoyaltyPoints', 'INTEGER DEFAULT 0'),
            ('completedDeliveries', 'INTEGER DEFAULT 0'),
            ('cancelledDeliveries', 'INTEGER DEFAULT 0'),
            ('phone', 'VARCHAR'),
            ('address', 'VARCHAR'),
            ('vehicleType', 'VARCHAR DEFAULT \'Motorcycle\''),
            ('latitude', 'DOUBLE PRECISION'),
            ('longitude', 'DOUBLE PRECISION'),
            ('createdAt', 'VARCHAR'),
            ('updatedAt', 'VARCHAR')
        ]
        for col_name, col_type in user_columns:
            try:
                conn.execute(text(f'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "{col_name}" {col_type};'))
                print(f"✓ Ensured User.{col_name}")
            except Exception as e:
                print(f"Note on User.{col_name}: {e}")

        # Order table columns
        order_columns = [
            ('riderId', 'VARCHAR'),
            ('cancelledRiderId', 'VARCHAR'),
            ('totalAmount', 'DOUBLE PRECISION'),
            ('discountApplied', 'DOUBLE PRECISION DEFAULT 0.0'),
            ('loyaltyEarned', 'INTEGER DEFAULT 0'),
            ('isEmergency', 'BOOLEAN DEFAULT FALSE'),
            ('surgeFee', 'DOUBLE PRECISION DEFAULT 0.0'),
            ('driverEarnings', 'DOUBLE PRECISION DEFAULT 0.0'),
            ('status', 'VARCHAR DEFAULT \'PENDING\''),
            ('paymentMethod', 'VARCHAR DEFAULT \'CASH_ON_DELIVERY\''),
            ('deliveryAddress', 'VARCHAR'),
            ('deliveryLat', 'DOUBLE PRECISION'),
            ('deliveryLng', 'DOUBLE PRECISION'),
            ('trackingNumber', 'VARCHAR'),
            ('estimatedDelivery', 'VARCHAR'),
            ('deliveryStartTime', 'VARCHAR'),
            ('deliveryEndTime', 'VARCHAR'),
            ('deliveryDurationMinutes', 'INTEGER'),
            ('deliveryDistance', 'DOUBLE PRECISION'),
            ('ratingEarned', 'DOUBLE PRECISION'),
            ('loyaltyPointsChange', 'INTEGER'),
            ('createdAt', 'VARCHAR')
        ]
        for col_name, col_type in order_columns:
            try:
                conn.execute(text(f'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "{col_name}" {col_type};'))
                print(f"✓ Ensured Order.{col_name}")
            except Exception as e:
                print(f"Note on Order.{col_name}: {e}")

        # Inventory table columns
        inv_columns = [
            ('batchNumber', 'VARCHAR'),
            ('mrp', 'DOUBLE PRECISION'),
            ('purchasePrice', 'DOUBLE PRECISION'),
            ('expiryDate', 'VARCHAR'),
            ('supplier', 'VARCHAR'),
            ('stockLocation', 'VARCHAR'),
            ('sold', 'INTEGER DEFAULT 0'),
            ('createdAt', 'VARCHAR'),
            ('updatedAt', 'VARCHAR')
        ]
        for col_name, col_type in inv_columns:
            try:
                conn.execute(text(f'ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "{col_name}" {col_type};'))
                print(f"✓ Ensured Inventory.{col_name}")
            except Exception as e:
                print(f"Note on Inventory.{col_name}: {e}")

        # Medicine table columns
        med_columns = [
            ('genericName', 'VARCHAR'),
            ('manufacturer', 'VARCHAR'),
            ('indications', 'VARCHAR'),
            ('createdAt', 'VARCHAR'),
            ('updatedAt', 'VARCHAR')
        ]
        for col_name, col_type in med_columns:
            try:
                conn.execute(text(f'ALTER TABLE "Medicine" ADD COLUMN IF NOT EXISTS "{col_name}" {col_type};'))
                print(f"✓ Ensured Medicine.{col_name}")
            except Exception as e:
                print(f"Note on Medicine.{col_name}: {e}")

        conn.commit()
        print("✓ All database migrations applied successfully!")

if __name__ == "__main__":
    migrate()
