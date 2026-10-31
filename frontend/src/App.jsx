import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'

// App Pages
import Dashboard from './pages/Dashboard'
import CustomerPortal from './pages/customer/Portal'
import UserList from './pages/users/UserList'
import ProductList from './pages/products/ProductList'
import ProductDetail from './pages/products/ProductDetail'
import PlanList from './pages/plans/PlanList'
import QuotationList from './pages/quotations/QuotationList'
import QuotationForm from './pages/quotations/QuotationForm'
import QuotationDetail from './pages/quotations/QuotationDetail'
import SubscriptionList from './pages/subscriptions/SubscriptionList'
import SubscriptionForm from './pages/subscriptions/SubscriptionForm'
import SubscriptionDetail from './pages/subscriptions/SubscriptionDetail'
import InvoiceList from './pages/invoices/InvoiceList'
import InvoiceDetail from './pages/invoices/InvoiceDetail'
import DiscountList from './pages/discounts/DiscountList'
import PaymentList from './pages/payments/PaymentList'
import PaymentDetail from './pages/payments/PaymentDetail'

function AppRoutes() {
  const { user } = useAuth()

  const defaultHome = user?.role === 'customer' ? '/portal' : '/dashboard'

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={defaultHome} replace />} />

      {/* Customer Portal */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={['customer']}>
            <Layout title="Client Portal">
              <CustomerPortal />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Finance Dashboard">
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Users */}
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['admin']}>
            <Layout title="User Management">
              <UserList />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Products */}
      <Route
        path="/products"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Product Management">
              <ProductList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Product Details & Variants">
              <ProductDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Plans */}
      <Route
        path="/plans"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Plan Management">
              <PlanList />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Quotations */}
      <Route
        path="/quotations"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Quotations">
              <QuotationList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/new"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Create Quotation">
              <QuotationForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/:id"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Quotation Details">
              <QuotationDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/:id/edit"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Edit Quotation">
              <QuotationForm />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Subscriptions */}
      <Route
        path="/subscriptions"
        element={
          <ProtectedRoute>
            <Layout title="Subscriptions">
              <SubscriptionList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscriptions/new"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="New Subscription">
              <SubscriptionForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscriptions/:id"
        element={
          <ProtectedRoute>
            <Layout title="Subscription Details">
              <SubscriptionDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Invoices */}
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <Layout title="Invoices">
              <InvoiceList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices/:id"
        element={
          <ProtectedRoute>
            <Layout title="Invoice Details">
              <InvoiceDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Discounts */}
      <Route
        path="/discounts"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <Layout title="Discount Management">
              <DiscountList />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Payments */}
      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Layout title="Payment Records">
              <PaymentList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments/:id"
        element={
          <ProtectedRoute>
            <Layout title="Payment Details">
              <PaymentDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={defaultHome} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  )
}
