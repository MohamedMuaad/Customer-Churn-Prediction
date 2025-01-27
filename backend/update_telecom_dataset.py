import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

def generate_telecom_data(n_customers=6000, months=6, seed=42):
    np.random.seed(seed)
    
    # District codes for broadband numbers
    DISTRICT_CODES = {
        'Colombo': '011', 'Jaffna': '021', 'Mannar': '023', 'Vavunia': '024',
        'Anuradhapura': '025', 'Trincomalee': '026', 'Polonnaruwa': '027',
        'Negombo': '031', 'Chilaw': '032', 'Gampaha': '033', 'Kaluthara': '034',
        'Kegalle': '035', 'Avissawella': '036', 'Kurunegala': '037',
        'Panadura': '038', 'Matara': '041', 'Ratnapura': '045',
        'Hambantota': '047', 'Hatton': '051', 'Nuwara Eliya': '052',
        'Nawalapitiya': '054', 'Badulla': '055', 'Bandarawela': '057',
        'Ampara': '063', 'Batticola': '065', 'Matale': '066', 'Kalmuni': '067',
        'Kandy': '081', 'Galle': '091'
    }
    
    def generate_broadband_number():
        district = random.choice(list(DISTRICT_CODES.values()))
        number = ''.join([str(random.randint(0, 9)) for _ in range(7)])
        return f"{district}{number}"
    
    customers = []
    broadband_numbers = {}  # Map customer_id to broadband_number
    
    for customer_id in range(1, n_customers + 1):
        # Generate unique broadband number for each customer
        broadband_numbers[customer_id] = generate_broadband_number()
        
        # Base characteristics
        base_usage = np.random.normal(500, 100)
        base_logins = np.random.poisson(20)
        base_bill = np.random.normal(50, 10)
        
        # Track patterns
        consecutive_high_latency = 0
        consecutive_payment_delays = 0
        usage_decline_count = 0
        
        prev_usage = None
        customer_metrics = []
        
        for month in range(months):
            monthly_usage = max(0, base_usage + np.random.normal(0, 50))
            login_attempts = max(0, base_logins + np.random.randint(-5, 5))
            payment_delay = np.random.randint(0, 15)
            network_latency = np.random.normal(50, 10)
            packet_loss = np.random.uniform(0, 2)
            download_speed = np.random.normal(100, 20)
            bill_amount = max(0, base_bill + np.random.normal(0, 5))
            
            # Track service degradation
            if network_latency > 65:
                consecutive_high_latency += 1
            else:
                consecutive_high_latency = 0
                
            if payment_delay > 7:
                consecutive_payment_delays += 1
            else:
                consecutive_payment_delays = 0
                
            if prev_usage and monthly_usage < prev_usage * 0.8:
                usage_decline_count += 1
            prev_usage = monthly_usage
            
            customer_metrics.append({
                'broadband_number': broadband_numbers[customer_id],
                'customer_id': customer_id,
                'month': month + 1,
                'data_usage_mb': round(monthly_usage, 2),
                'login_attempts': int(login_attempts),
                'bill_amount': round(bill_amount, 2),
                'payment_delay_days': payment_delay,
                'network_latency_ms': round(network_latency, 2),
                'packet_loss_percent': round(packet_loss, 2),
                'download_speed_mbps': round(download_speed, 2)
            })
            
            # Predict churn for last month
            if month == months - 1:
                metrics = pd.DataFrame(customer_metrics)
                
                high_risk = (
                    consecutive_high_latency >= 3 or
                    consecutive_payment_delays >= 2 or
                    usage_decline_count >= 2 or
                    metrics['packet_loss_percent'].mean() > 1.2 or
                    metrics['download_speed_mbps'].mean() < 70 or
                    metrics['login_attempts'].mean() < 12 or
                    metrics['payment_delay_days'].mean() > 8 or
                    metrics['bill_amount'].mean() > 65
                )
                
                medium_risk = (
                    metrics['network_latency_ms'].std() > 15 or
                    metrics['data_usage_mb'].std() / metrics['data_usage_mb'].mean() > 0.3 or
                    metrics['login_attempts'].tail(2).mean() < metrics['login_attempts'].head(2).mean() * 0.8
                )
                
                churn_probability = 0.8 if high_risk else (0.4 if medium_risk else 0.1)
                customer_metrics[-1]['churn_next_month'] = 1 if np.random.random() < churn_probability else 0
            else:
                customer_metrics[-1]['churn_next_month'] = 0
                
            customers.append(customer_metrics[-1])
    
    df = pd.DataFrame(customers)
    df = df.sort_values(['customer_id', 'month'])
    
    # Save the dataset
    df.to_csv('telecom_churn_data.csv', index=False)
    
    # Save the broadband number mapping
    mapping_df = pd.DataFrame({
        'customer_id': list(broadband_numbers.keys()),
        'broadband_number': list(broadband_numbers.values())
    })
    mapping_df.to_csv('customer_broadband_mapping.csv', index=False)
    
    return df

if __name__ == "__main__":
    df = generate_telecom_data()
    print("Generated dataset shape:", df.shape)
    print("\nSample of broadband numbers:")
    print(df[['broadband_number', 'customer_id']].head(10))