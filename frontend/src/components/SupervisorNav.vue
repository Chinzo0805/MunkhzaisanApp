<template>
  <nav class="sup-nav">
    <router-link to="/dashboard" class="sup-nav-home" title="Нүүр хуудас">🏠</router-link>
    <div class="sup-nav-links">
      <router-link to="/supervisor-ta-summary"  class="sup-nav-link" active-class="active-link">📊 Ирц</router-link>
      <router-link to="/project-summary"        class="sup-nav-link" active-class="active-link">📋 Төсөл</router-link>
      <router-link to="/supervisor-salary"      class="sup-nav-link" active-class="active-link">💰 Цалин</router-link>
      <router-link to="/confirmed-salary"       class="sup-nav-link" active-class="active-link">✅ Батлагдсан</router-link>
      <router-link to="/supervisor-bounty"      class="sup-nav-link" active-class="active-link">🏆 Урамшуулал</router-link>
      <router-link to="/transaction-report"     class="sup-nav-link" active-class="active-link">💵 Гүйлгээ</router-link>
      <router-link to="/transaction-check"      class="sup-nav-link" active-class="active-link">🧾 eBarimt/НӨАТ</router-link>
      <router-link to="/employee-table"         class="sup-nav-link" active-class="active-link">👥 Ажилтан</router-link>
      <router-link to="/management-goals"       class="sup-nav-link" active-class="active-link">🎯 Зорилго</router-link>
      <router-link to="/salary-report"          class="sup-nav-link my-salary" active-class="active-link" title="Миний өөрийн цалин">👤 Миний цалин</router-link>
    </div>
  </nav>
</template>

<style scoped>
.sup-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e293b;
  padding: 10px 24px;
  border-radius: 0;
  margin-bottom: 20px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 100;
  /* bleed edge-to-edge regardless of parent container padding */
  width: 100vw;
  position: relative;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
}

.sup-nav-home {
  font-size: 18px;
  text-decoration: none;
  padding: 5px 9px;
  border-radius: 5px;
  color: #cbd5e1;
  transition: background 0.15s;
  flex-shrink: 0;
}
.sup-nav-home:hover { background: #334155; }

.sup-nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sup-nav-link {
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  color: #cbd5e1;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.sup-nav-link:hover { background: #334155; color: #f1f5f9; }
.sup-nav-link.active-link { background: #3b82f6; color: #fff; }

.my-salary { border: 1px solid #475569; margin-left: 6px; }
.my-salary.active-link { background: #059669; border-color: #059669; }
</style>
