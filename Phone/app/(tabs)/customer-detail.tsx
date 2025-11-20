import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

type Customer = {
  customer_id: number;
  first_name: string;
  location: string;
  status: string;
  queue_position: number;
  access_code: string;
  add_time?: string;
  start_time?: string;
};

// For Android emulator, use: http://10.0.2.2:3000
// For iOS simulator, use: http://localhost:3000
// For physical device, use your computer's IP: http://192.168.x.x:3000
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; customerId?: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.token || !params.customerId) {
      router.replace('/(tabs)/' as any);
      return;
    }

    loadCustomer();
  }, [params.token, params.customerId]);

  const loadCustomer = async () => {
    if (!params.token || !params.customerId) return;

    setLoading(true);
    setError(null);

    try {
      // First, try to get from queue endpoint
      const queueResponse = await fetch(`${API_BASE}/queue`, {
        headers: {
          Authorization: `Bearer ${params.token}`,
        },
      });

      if (queueResponse.ok) {
        const customers = await queueResponse.json();
        const foundCustomer = customers.find(
          (c: Customer) => c.customer_id.toString() === params.customerId
        );
        
        if (foundCustomer) {
          setCustomer(foundCustomer);
          setLoading(false);
          return;
        }
      }

      // If not found in queue, try direct customer endpoint
      const customerResponse = await fetch(
        `${API_BASE}/queue/customer-id/${params.customerId}`,
        {
          headers: {
            Authorization: `Bearer ${params.token}`,
          },
        }
      );

      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        setCustomer(customerData);
      } else {
        const errorData = await customerResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Customer not found (${customerResponse.status})`);
      }
    } catch (err: any) {
      console.error('Error loading customer:', err);
      setError(err.message ?? 'Failed to load customer information');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!params.token || !params.customerId) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/queue/${params.customerId}/complete`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${params.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to mark customer as complete');
      }

      // Navigate back to queue
      router.replace({
        pathname: '/(tabs)/queue' as any,
        params: { token: params.token },
      });
    } catch (err: any) {
      console.error('Error marking complete:', err);
      setError(err.message ?? 'Failed to mark customer as complete');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#273c75" />
          <Text style={styles.loadingText}>Loading customer information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !customer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/(tabs)/queue' as any)}
          >
            <Text style={styles.buttonText}>Return to Queue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Customer not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Status: {customer.status.toUpperCase()}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{customer.first_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location:</Text>
            <Text style={styles.infoValue}>{customer.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Queue Position:</Text>
            <Text style={styles.infoValue}>
              {customer.queue_position || 'In Progress'}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Added to Queue:</Text>
            <Text style={styles.infoValue}>{formatDate(customer.add_time)}</Text>
          </View>

          {customer.start_time && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Service Started:</Text>
              <Text style={styles.infoValue}>{formatDate(customer.start_time)}</Text>
            </View>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {customer.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.button, styles.completeButton]}
            onPress={handleMarkComplete}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Mark Complete</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#273c75',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8fa6',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  statusBadge: {
    backgroundColor: '#273c75',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#273c75',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#7f8fa6',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  button: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  completeButton: {
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#e84118',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
});

