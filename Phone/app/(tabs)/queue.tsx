import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

type Customer = {
  customer_id: number;
  first_name: string;
  location: string;
  status: string;
  queue_position: number;
  access_code: string;
};

// For Android emulator, use: http://10.0.2.2:3000
// For iOS simulator, use: http://localhost:3000
// For physical device, use your computer's IP: http://192.168.x.x:3000
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export default function QueueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [inProgressCustomerId, setInProgressCustomerId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Get token from route params
    if (params?.token) {
      setToken(params.token);
      loadQueue(params.token);
    } else {
      // If no token, go back to login
      router.replace('/(tabs)/' as any);
    }
  }, [params.token, router]);

  const loadQueue = async (sessionToken: string) => {
    if (!sessionToken) {
      return;
    }

    setLoadingQueue(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/queue`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load queue: ${response.status}`);
      }

      const data = await response.json();
      setCustomers(data);
      
      // Check if there's an in-progress customer
      const inProgress = data.find((c: Customer) => c.status === 'in_progress');
      if (inProgress) {
        setInProgressCustomerId(inProgress.customer_id);
        setSelectedCustomerId(inProgress.customer_id);
      } else {
        setInProgressCustomerId(null);
      }
    } catch (err: any) {
      console.error('Queue load error:', err);
      if (err.message === 'Network request failed' || err.message?.includes('Network')) {
        setError(`Cannot connect to server at ${API_BASE}. Check your network settings.`);
      } else {
        setError(err.message ?? 'Unable to load queue');
      }
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleCustomerPress = (customer: Customer) => {
    // If there's an in-progress customer, only allow interaction with that one
    if (inProgressCustomerId && customer.customer_id !== inProgressCustomerId) {
      return;
    }
    
    // Allow selection of pending or in-progress customers
    if (customer.status !== 'pending' && customer.status !== 'in_progress') {
      return;
    }

    setSelectedCustomerId(
      selectedCustomerId === customer.customer_id ? null : customer.customer_id
    );
  };

  const handleMarkInProgress = async (customerId: number) => {
    if (!token) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/queue/${customerId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to mark customer as in progress');
      }

      // Navigate to customer detail page
      router.push({
        pathname: '/(tabs)/customer-detail' as any,
        params: { token, customerId: customerId.toString() },
      });
    } catch (err: any) {
      console.error('Error marking in progress:', err);
      setError(err.message ?? 'Failed to mark customer as in progress');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkComplete = async (customerId: number) => {
    if (!token) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/queue/${customerId}/complete`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to mark customer as complete');
      }

      setInProgressCustomerId(null);
      setSelectedCustomerId(null);
      await loadQueue(token);
    } catch (err: any) {
      console.error('Error marking complete:', err);
      setError(err.message ?? 'Failed to mark customer as complete');
    } finally {
      setProcessing(false);
    }
  };

  const renderCustomer = ({ item }: { item: Customer }) => {
    const isSelected = selectedCustomerId === item.customer_id;
    const isInProgress = item.status === 'in_progress';
    const isPending = item.status === 'pending';
    const canInteract = !inProgressCustomerId || item.customer_id === inProgressCustomerId;
    const isDisabled = !canInteract && isPending;

    return (
      <TouchableOpacity
        style={[
          styles.customerCard,
          isSelected && styles.customerCardSelected,
          isDisabled && styles.customerCardDisabled,
        ]}
        onPress={() => handleCustomerPress(item)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <View style={styles.customerContent}>
          <View style={styles.customerHeader}>
            <View style={styles.customerNameContainer}>
              <Text style={styles.customerName}>{item.first_name}</Text>
              {isSelected && (
                <View style={styles.actionBox}>
                  {isPending && (
                    <>
                      <Text style={styles.talkToCustomerLabel}>Talk to Customer</Text>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.inProgressButton]}
                        onPress={() => handleMarkInProgress(item.customer_id)}
                        disabled={processing}
                      >
                        {processing ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.actionButtonText}>Mark In Progress</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                  {isInProgress && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => {
                        router.push({
                          pathname: '/(tabs)/customer-detail' as any,
                          params: { token: token || '', customerId: item.customer_id.toString() },
                        });
                      }}
                    >
                      <Text style={styles.actionButtonText}>View Details</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            <Text style={styles.customerStatus}>{item.status}</Text>
          </View>
          <Text style={styles.customerDetail}>Location: {item.location}</Text>
          <Text style={styles.customerDetail}>
            Queue Position: {item.queue_position || 'In Progress'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#273c75" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/' as any)}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Current Queue</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadQueue(token)}
          disabled={loadingQueue}
        >
          {loadingQueue ? (
            <ActivityIndicator color="#273c75" size="small" />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      {inProgressCustomerId && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            You are currently helping a customer. Complete that interaction before selecting another.
          </Text>
        </View>
      )}

      <FlatList
        data={customers}
        keyExtractor={(item) => item.customer_id.toString()}
        renderItem={renderCustomer}
        refreshControl={
          <RefreshControl refreshing={loadingQueue} onRefresh={() => loadQueue(token)} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyState}>
            {loadingQueue ? 'Loading queue...' : 'No customers waiting.'}
          </Text>
        }
        contentContainerStyle={styles.listContent}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 16,
    color: '#273c75',
    fontWeight: '600',
  },
  noticeBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  noticeText: {
    fontSize: 14,
    color: '#856404',
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 1,
  },
  customerCardSelected: {
    borderWidth: 2,
    borderColor: '#273c75',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  customerCardDisabled: {
    opacity: 0.5,
  },
  customerContent: {
    flex: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  customerNameContainer: {
    flex: 1,
    marginRight: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  customerStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionBox: {
    marginTop: 4,
  },
  talkToCustomerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#273c75',
    marginBottom: 8,
  },
  actionButton: {
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 150,
  },
  inProgressButton: {
    backgroundColor: '#273c75',
  },
  completeButton: {
    backgroundColor: '#27ae60',
  },
  viewButton: {
    backgroundColor: '#3498db',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  customerDetail: {
    fontSize: 14,
    marginBottom: 2,
    color: '#555',
  },
  emptyState: {
    textAlign: 'center',
    marginTop: 40,
    color: '#7f8fa6',
    fontSize: 16,
  },
  errorText: {
    color: '#e84118',
    textAlign: 'center',
    margin: 16,
    fontSize: 14,
  },
});

