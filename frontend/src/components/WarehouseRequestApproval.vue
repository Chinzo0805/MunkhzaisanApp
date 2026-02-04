<template>
  <div class="warehouse-approval">
    <h4>Warehouse Material Requests</h4>
    
    <div class="filter-tabs">
      <button 
        @click="filterStatus = 'pending'" 
        :class="['tab-btn', { active: filterStatus === 'pending' }]"
      >
        Pending ({{ pendingCount }})
      </button>
      <button 
        @click="filterStatus = 'all'" 
        :class="['tab-btn', { active: filterStatus === 'all' }]"
      >
        All Requests
      </button>
    </div>

    <div v-if="filteredRequests.length === 0" class="no-requests">
      No requests found
    </div>

    <div v-else class="requests-grid">
      <div 
        v-for="request in filteredRequests" 
        :key="request.id" 
        class="request-card"
        :class="'status-' + request.status"
      >
        <div class="request-header">
          <div>
            <h5>{{ request.WarehouseName }}</h5>
            <span class="request-category">{{ request.Category || 'Warehouse Item' }}</span>
          </div>
          <span class="status-badge" :class="'badge-' + request.status">
            {{ request.status }}
          </span>
        </div>

        <div class="request-body">
          <div class="info-grid">
            <div class="info-item">
              <label>Requested By:</label>
              <span>{{ request.requestedEmpName }}</span>
            </div>
            <div class="info-item">
              <label>Quantity:</label>
              <span class="quantity">{{ request.quantity }}</span>
            </div>
            <div class="info-item">
              <label>Project:</label>
              <span>{{ request.ProjectName || request.projectID || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Requested:</label>
              <span>{{ formatDate(request.requestedAt) }}</span>
            </div>
          </div>

          <div class="purpose-section">
            <label>Purpose:</label>
            <p>{{ request.purpose }}</p>
          </div>

          <div v-if="request.status === 'approved'" class="approval-info">
            <small>✓ Approved on {{ formatDate(request.approvedAt) }}</small>
            <small v-if="request.transactionId">Transaction ID: {{ request.transactionId }}</small>
          </div>

          <div v-if="request.status === 'rejected'" class="rejection-info">
            <small>✗ Rejected on {{ formatDate(request.rejectedAt) }}</small>
            <small v-if="request.rejectionReason"><strong>Reason:</strong> {{ request.rejectionReason }}</small>
          </div>
        </div>

        <div v-if="request.status === 'pending'" class="request-actions">
          <button @click="approveRequest(request)" class="btn-approve">
            ✓ Approve
          </button>
          <button @click="openRejectDialog(request)" class="btn-reject">
            ✗ Reject
          </button>
        </div>
      </div>
    </div>

    <!-- Reject Dialog -->
    <div v-if="showRejectDialog" class="modal-overlay" @click.self="closeRejectDialog">
      <div class="modal-content">
        <div class="modal-header">
          <h4>Reject Request</h4>
          <button class="close-btn" @click="closeRejectDialog">&times;</button>
        </div>
        <p>Rejecting request for <strong>{{ selectedRequest?.WarehouseName }}</strong></p>
        <div class="form-group">
          <label>Reason for rejection:</label>
          <textarea 
            v-model="rejectionReason" 
            rows="3" 
            placeholder="Explain why this request is rejected..."
            required
          ></textarea>
        </div>
        <div class="modal-actions">
          <button @click="confirmReject" class="btn-confirm-reject">Confirm Reject</button>
          <button @click="closeRejectDialog" class="btn-cancel">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export default {
  name: 'WarehouseRequestApproval',
  setup() {
    const requests = ref([]);
    const filterStatus = ref('pending');
    const showRejectDialog = ref(false);
    const selectedRequest = ref(null);
    const rejectionReason = ref('');

    const filteredRequests = computed(() => {
      if (filterStatus.value === 'pending') {
        return requests.value.filter(r => r.status === 'pending');
      }
      return requests.value;
    });

    const pendingCount = computed(() => {
      return requests.value.filter(r => r.status === 'pending').length;
    });

    const loadRequests = async () => {
      try {
        const q = query(
          collection(db, 'warehouseRequests'),
          orderBy('requestedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        requests.value = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error('Error loading requests:', error);
        alert('Failed to load requests');
      }
    };

    const approveRequest = async (request) => {
      if (!confirm(`Approve request for ${request.quantity} ${request.WarehouseName}?`)) {
        return;
      }

      try {
        const { manageWarehouseRequest } = await import('../services/api');
        const result = await manageWarehouseRequest({
          action: 'approve',
          requestId: request.id,
        });

        if (result.success) {
          alert('Request approved! Transaction created.');
          await loadRequests();
        } else {
          alert('Failed to approve: ' + result.error);
        }
      } catch (error) {
        console.error('Error approving request:', error);
        alert('Error: ' + error.message);
      }
    };

    const openRejectDialog = (request) => {
      selectedRequest.value = request;
      rejectionReason.value = '';
      showRejectDialog.value = true;
    };

    const closeRejectDialog = () => {
      showRejectDialog.value = false;
      selectedRequest.value = null;
      rejectionReason.value = '';
    };

    const confirmReject = async () => {
      if (!rejectionReason.value.trim()) {
        alert('Please provide a reason for rejection');
        return;
      }

      try {
        const { manageWarehouseRequest } = await import('../services/api');
        const result = await manageWarehouseRequest({
          action: 'reject',
          requestId: selectedRequest.value.id,
          request: {
            reason: rejectionReason.value,
          },
        });

        if (result.success) {
          alert('Request rejected');
          await loadRequests();
          closeRejectDialog();
        } else {
          alert('Failed to reject: ' + result.error);
        }
      } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Error: ' + error.message);
      }
    };

    const formatDate = (timestamp) => {
      if (!timestamp) return '';
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return '';
      }
    };

    onMounted(loadRequests);

    return {
      requests,
      filteredRequests,
      filterStatus,
      pendingCount,
      showRejectDialog,
      selectedRequest,
      rejectionReason,
      approveRequest,
      openRejectDialog,
      closeRejectDialog,
      confirmReject,
      formatDate,
    };
  },
};
</script>

<style scoped>
.warehouse-approval {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h4 {
  margin-bottom: 20px;
  color: #333;
}

.filter-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 8px 16px;
  border: 2px solid #dee2e6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: #007bff;
  color: #007bff;
}

.tab-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.no-requests {
  padding: 40px;
  text-align: center;
  color: #999;
}

.requests-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
}

.request-card {
  border: 2px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.request-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.request-card.status-pending {
  border-left: 4px solid #ffc107;
}

.request-card.status-approved {
  border-left: 4px solid #28a745;
  background: #f8fff9;
}

.request-card.status-rejected {
  border-left: 4px solid #dc3545;
  background: #fff8f8;
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #dee2e6;
}

.request-header h5 {
  margin: 0 0 5px 0;
  color: #333;
}

.request-category {
  font-size: 12px;
  color: #666;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-pending {
  background: #ffc107;
  color: #000;
}

.badge-approved {
  background: #28a745;
  color: white;
}

.badge-rejected {
  background: #dc3545;
  color: white;
}

.request-body {
  margin-bottom: 15px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-item label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  font-weight: 600;
}

.info-item span {
  font-size: 14px;
  color: #333;
}

.quantity {
  font-weight: 600;
  color: #007bff;
}

.purpose-section {
  margin-top: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.purpose-section label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  font-weight: 600;
  display: block;
  margin-bottom: 5px;
}

.purpose-section p {
  margin: 0;
  font-size: 14px;
  color: #333;
  white-space: pre-wrap;
}

.approval-info,
.rejection-info {
  margin-top: 10px;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
}

.approval-info {
  background: #d4edda;
  color: #155724;
}

.rejection-info {
  background: #f8d7da;
  color: #721c24;
}

.approval-info small,
.rejection-info small {
  display: block;
  margin: 2px 0;
}

.request-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.btn-approve,
.btn-reject {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-approve {
  background: #28a745;
  color: white;
}

.btn-approve:hover {
  background: #218838;
}

.btn-reject {
  background: #dc3545;
  color: white;
}

.btn-reject:hover {
  background: #c82333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.modal-header h4 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  color: #000;
}

.form-group {
  margin: 15px 0;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 5px;
}

.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-confirm-reject,
.btn-cancel {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.btn-confirm-reject {
  background: #dc3545;
  color: white;
}

.btn-confirm-reject:hover {
  background: #c82333;
}

.btn-cancel {
  background: #6c757d;
  color: white;
}

.btn-cancel:hover {
  background: #5a6268;
}
</style>
