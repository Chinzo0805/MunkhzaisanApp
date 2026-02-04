<template>
  <div class="warehouse-request-form">
    <h3>Request Warehouse Materials</h3>
    
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="warehouseItem">Warehouse Item *</label>
        <select id="warehouseItem" v-model="formData.WarehouseID" @change="onItemChange" required>
          <option value="">Select item to request</option>
          <option v-for="item in warehouseItems" :key="item.id" :value="item.id">
            {{ item.Name }} ({{ item.Category }}) - Available: {{ item.quantity }} {{ item.unit }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="quantity">Quantity Needed *</label>
        <input 
          id="quantity" 
          v-model.number="formData.quantity" 
          type="number" 
          step="0.01"
          min="0.01"
          :max="selectedItem?.quantity || 999999"
          required
        />
        <small v-if="selectedItem" class="hint">
          Available: {{ selectedItem.quantity }} {{ selectedItem.unit }}
        </small>
        <small v-if="formData.quantity > (selectedItem?.quantity || 0)" class="error">
          Insufficient quantity!
        </small>
      </div>

      <div class="form-group">
        <label for="project">Project *</label>
        <select id="project" v-model="formData.projectID" @change="onProjectChange" required>
          <option value="">Select project</option>
          <option v-for="project in activeProjects" :key="project.id" :value="project.id">
            {{ project.id }} - {{ project.siteLocation }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="purpose">Purpose / Reason *</label>
        <textarea 
          id="purpose"
          v-model="formData.purpose" 
          rows="3"
          required
          placeholder="Explain why you need these materials..."
        ></textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-submit" :disabled="submitting || formData.quantity > (selectedItem?.quantity || 0)">
          {{ submitting ? 'Submitting...' : 'Submit Request' }}
        </button>
        <button type="button" @click="resetForm" class="btn-cancel">Reset</button>
      </div>
    </form>

    <!-- My Requests -->
    <div class="my-requests">
      <h4>My Requests</h4>
      
      <div v-if="myRequests.length === 0" class="no-requests">
        No requests yet
      </div>

      <div v-else class="requests-list">
        <div v-for="request in myRequests" :key="request.id" class="request-card" :class="'status-' + request.status">
          <div class="request-header">
            <span class="request-item">{{ request.WarehouseName }}</span>
            <span class="request-status" :class="'badge-' + request.status">{{ request.status }}</span>
          </div>
          <div class="request-details">
            <p><strong>Quantity:</strong> {{ request.quantity }}</p>
            <p><strong>Project:</strong> {{ request.ProjectName || request.projectID }}</p>
            <p><strong>Purpose:</strong> {{ request.purpose }}</p>
            <p><strong>Requested:</strong> {{ formatDate(request.requestedAt) }}</p>
            <p v-if="request.status === 'approved'"><strong>Approved:</strong> {{ formatDate(request.approvedAt) }}</p>
            <p v-if="request.status === 'rejected'">
              <strong>Rejected:</strong> {{ formatDate(request.rejectedAt) }}<br/>
              <strong>Reason:</strong> {{ request.rejectionReason }}
            </p>
          </div>
          <div v-if="request.status === 'pending'" class="request-actions">
            <button @click="deleteRequest(request.id)" class="btn-delete-small">Cancel Request</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/auth';
import { useProjectsStore } from '../stores/projects';

export default {
  name: 'WarehouseRequestForm',
  setup() {
    const authStore = useAuthStore();
    const projectsStore = useProjectsStore();

    const warehouseItems = ref([]);
    const myRequests = ref([]);
    const submitting = ref(false);

    const formData = ref({
      WarehouseID: '',
      WarehouseName: '',
      quantity: 0,
      projectID: '',
      ProjectName: '',
      purpose: '',
    });

    const selectedItem = computed(() => {
      return warehouseItems.value.find(item => item.id === formData.value.WarehouseID);
    });

    const activeProjects = computed(() => {
      return projectsStore.projects.filter(p => 
        p.projectStatus !== 'Хаагдсан' && p.projectStatus !== 'Closed'
      );
    });

    const loadWarehouseItems = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'warehouse'));
        warehouseItems.value = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(item => item.quantity > 0) // Only show items with stock
          .sort((a, b) => a.Name.localeCompare(b.Name));
      } catch (error) {
        console.error('Error loading warehouse items:', error);
        alert('Failed to load warehouse items');
      }
    };

    const loadMyRequests = async () => {
      try {
        if (!authStore.userData?.employeeId) {
          console.log('No employee ID found');
          return;
        }

        const q = query(
          collection(db, 'warehouseRequests'),
          where('requestedEmpID', '==', authStore.userData.employeeId)
        );
        
        const querySnapshot = await getDocs(q);
        myRequests.value = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const dateA = a.requestedAt?.toDate?.() || new Date(0);
            const dateB = b.requestedAt?.toDate?.() || new Date(0);
            return dateB - dateA; // Most recent first
          });
      } catch (error) {
        console.error('Error loading requests:', error);
      }
    };

    const onItemChange = () => {
      if (selectedItem.value) {
        formData.value.WarehouseName = selectedItem.value.Name;
      }
    };

    const onProjectChange = () => {
      const project = projectsStore.projects.find(p => p.id === formData.value.projectID);
      if (project) {
        formData.value.ProjectName = project.siteLocation || project.ProjectName || '';
      }
    };

    const handleSubmit = async () => {
      if (formData.value.quantity > (selectedItem.value?.quantity || 0)) {
        alert('Requested quantity exceeds available stock!');
        return;
      }

      submitting.value = true;

      try {
        const { manageWarehouseRequest } = await import('../services/api');
        
        const result = await manageWarehouseRequest({
          action: 'create',
          request: {
            WarehouseID: formData.value.WarehouseID,
            WarehouseName: formData.value.WarehouseName,
            quantity: formData.value.quantity,
            requestedEmpID: authStore.userData.employeeId,
            requestedEmpName: `${authStore.userData.employeeFirstName} ${authStore.userData.employeeLastName}`,
            projectID: formData.value.projectID,
            ProjectName: formData.value.ProjectName,
            purpose: formData.value.purpose,
          },
        });

        if (result.success) {
          alert('Request submitted successfully!');
          resetForm();
          await loadMyRequests();
        } else {
          alert('Failed to submit request: ' + result.error);
        }
      } catch (error) {
        console.error('Error submitting request:', error);
        alert('Error submitting request: ' + error.message);
      } finally {
        submitting.value = false;
      }
    };

    const deleteRequest = async (requestId) => {
      if (!confirm('Cancel this request?')) return;

      try {
        const { manageWarehouseRequest } = await import('../services/api');
        const result = await manageWarehouseRequest({
          action: 'delete',
          requestId,
        });

        if (result.success) {
          alert('Request cancelled');
          await loadMyRequests();
        } else {
          alert('Failed to cancel request: ' + result.error);
        }
      } catch (error) {
        console.error('Error cancelling request:', error);
        alert('Error: ' + error.message);
      }
    };

    const resetForm = () => {
      formData.value = {
        WarehouseID: '',
        WarehouseName: '',
        quantity: 0,
        projectID: '',
        ProjectName: '',
        purpose: '',
      };
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

    onMounted(async () => {
      await Promise.all([
        loadWarehouseItems(),
        loadMyRequests(),
      ]);
    });

    return {
      formData,
      selectedItem,
      activeProjects,
      warehouseItems,
      myRequests,
      submitting,
      onItemChange,
      onProjectChange,
      handleSubmit,
      deleteRequest,
      resetForm,
      formatDate,
    };
  },
};
</script>

<style scoped>
.warehouse-request-form {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3, h4 {
  margin-bottom: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 5px;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
}

.hint {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}

.error {
  color: #dc3545;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-submit,
.btn-cancel {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-submit {
  background: #28a745;
  color: white;
  flex: 1;
}

.btn-submit:hover:not(:disabled) {
  background: #218838;
}

.btn-submit:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-cancel {
  background: #6c757d;
  color: white;
}

.btn-cancel:hover {
  background: #5a6268;
}

.my-requests {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 2px solid #dee2e6;
}

.no-requests {
  padding: 20px;
  text-align: center;
  color: #999;
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.request-card {
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #dee2e6;
}

.request-card.status-pending {
  border-left-color: #ffc107;
  background: #fff9e6;
}

.request-card.status-approved {
  border-left-color: #28a745;
  background: #e8f5e9;
}

.request-card.status-rejected {
  border-left-color: #dc3545;
  background: #fee;
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.request-item {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.request-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
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

.request-details p {
  margin: 5px 0;
  font-size: 14px;
  color: #555;
}

.request-actions {
  margin-top: 10px;
}

.btn-delete-small {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete-small:hover {
  background: #c82333;
}
</style>
