import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { buildMembershipFinancials, formatCurrency, formatDisplayDate } from '../lib/formatters';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar';
import { compressImage, cropImageToFile, getCropLayout, readFileAsDataURL } from '../lib/imageUtils';

const PLAN_OPTIONS = {
  Monthly: { durationDays: 30, label: '30 Days' },
  Quarterly: { durationDays: 90, label: '90 Days' },
  Yearly: { durationDays: 365, label: '365 Days' }
};

const CROP_FRAME_SIZE = 288;

function createInitialFormData() {
  return {
    name: '',
    phone: '',
    gender: '',
    age: '',
    planType: 'Monthly',
    planPrice: '',
    initialPaid: '',
    planDuration: PLAN_OPTIONS.Monthly.durationDays,
    joinDate: new Date().toISOString().split('T')[0],
    photoURL: '',
    photoPath: ''
  };
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function calculateExpiryDate(joinDate, planDuration) {
  if (!joinDate || !planDuration) return '';

  const expiryDate = new Date(joinDate);
  expiryDate.setDate(expiryDate.getDate() + Number(planDuration));
  return expiryDate.toISOString().split('T')[0];
}

function getPlanConfig(planType) {
  return PLAN_OPTIONS[planType] || PLAN_OPTIONS.Monthly;
}

function normalizeAmount(value) {
  return Math.max(Number(value || 0), 0);
}

function getMembershipStatus(member) {
  if (member.balanceDue > 0) {
    return { key: 'partial', label: 'Partial', color: 'text-amber-500 border-amber-500/30 bg-amber-500/10' };
  }
  if (!member.expiry_date) {
    return { key: 'active', label: 'Active', color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(member.expiry_date);
  expiry.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

  if (daysLeft < 0) {
    return { key: 'expired', label: 'Expired', color: 'text-error border-error/30 bg-error/10' };
  }
  if (daysLeft <= 3) {
    return { key: 'expiring', label: 'Expiring', color: 'text-primary border-primary/30 bg-primary/10' };
  }
  return { key: 'active', label: 'Active', color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' };
}

const WhatsAppIcon = ({ member }) => {
  if (!member || !member.phone) return null;
  const num = String(member.phone).replace(/\D/g, '');
  const waNum = num.length === 10 ? '91' + num : num;
  
  let msg = `Hey ${member.name || ''},`;
  if (member.expiry_date) {
    const expiryDate = new Date(member.expiry_date);
    const formattedDate = expiryDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const expiryCheck = new Date(expiryDate);
    expiryCheck.setHours(23, 59, 59, 999);
    
    if (expiryCheck < new Date()) {
      msg = `Hey ${member.name}, your gym plan expired on ${formattedDate}. Please renew it as soon as possible to continue your workouts!`;
    } else {
      msg = `Hey ${member.name}, your gym plan is expiring on ${formattedDate}. Please renew it soon to avoid any interruptions to your workouts!`;
    }
  }

  return (
    <a
      href={`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-green-500 hover:text-green-400 transition-colors inline-flex items-center ml-2"
      title="Message on WhatsApp"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </a>
  );
};
export default function Members() {
  const { currentUser } = useAuth();
  const { memberSearch, setMemberSearch } = useOutletContext();
  const [members, setMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState(createInitialFormData());
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pendingPhotoSource, setPendingPhotoSource] = useState(null);
  const [cropImageSize, setCropImageSize] = useState({ width: 0, height: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [selectedHistoryMember, setSelectedHistoryMember] = useState(null);
  const [payments, setPayments] = useState([]);
  const [renewalData, setRenewalData] = useState({ amount: '', method: 'Cash', planType: 'Monthly', planPrice: '' });
  const [renewError, setRenewError] = useState('');
  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fetchMembers = async () => {
    if (!currentUser) return;
    try {
      const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
      const snapshot = await getDocs(membersRef);
      const list = [];
      snapshot.forEach((memberDoc) => {
        const data = memberDoc.data();
        const financials = buildMembershipFinancials(
          data.planPrice,
          data.amountPaid ?? data.planPrice ?? 0
        );

        list.push({
          id: memberDoc.id,
          ...data,
          amountPaid: data.amountPaid ?? financials.amountPaid,
          balanceDue: data.balanceDue ?? financials.balanceDue,
          paymentStatus: data.paymentStatus || financials.paymentStatus
        });
      });
      list.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      setMembers(list);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  const fetchPayments = async () => {
    if (!currentUser) return;
    try {
      const paymentsRef = collection(db, 'gyms', currentUser.uid, 'payments');
      const snapshot = await getDocs(paymentsRef);
      const list = [];
      snapshot.forEach((paymentDoc) => {
        list.push({ id: paymentDoc.id, ...paymentDoc.data() });
      });
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(list);
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchMembers();
      fetchPayments();
    }
  }, [currentUser]);

  useEffect(() => {
    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setFormError("Could not access camera. Please allow camera permissions.");
          setShowCamera(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setShowCamera(false);
      openCropper(dataUrl);
    }
  };

  const computedExpiryDate = calculateExpiryDate(formData.joinDate, formData.planDuration);

  function closeModal() {
    setShowAddModal(false);
    setEditingId(null);
    setFormError('');
    setFormData(createInitialFormData());
    setPhotoFile(null);
    setPhotoPreview(null);
    setPendingPhotoSource(null);
    setCropImageSize({ width: 0, height: 0 });
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setShowCropModal(false);
    setShowPhotoViewer(false);
    setShowCamera(false);
  }

  function closeRenewModal() {
    setShowRenewModal(false);
    setRenewingMember(null);
    setRenewalData({ amount: '', method: 'Cash', planType: 'Monthly', planPrice: '' });
    setRenewError('');
  }

  function closeHistoryModal() {
    setShowHistoryModal(false);
    setSelectedHistoryMember(null);
  }

  function handlePlanTypeChange(value) {
    setFormData((current) => ({
      ...current,
      planType: value,
      planDuration: PLAN_OPTIONS[value].durationDays
    }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setFormError('');
      setIsUploading(true);

      const normalizedPhone = normalizePhone(formData.phone);
      let targetMemberId = editingId;
      const existingMember = editingId
        ? members.find((member) => member.id === editingId)
        : null;

      const payload = {
        name: formData.name.trim(),
        phone: normalizedPhone,
        gender: formData.gender || '',
        age: formData.age ? Number(formData.age) : null,
        plan: formData.planType,
        planType: formData.planType,
        planPrice: Number(formData.planPrice),
        planDuration: Number(formData.planDuration),
        join_date: formData.joinDate,
        expiry_date: calculateExpiryDate(formData.joinDate, formData.planDuration)
      };

      if (!editingId && formData.initialPaid !== '' && Number(formData.initialPaid) > payload.planPrice) {
        setFormError('Amount received now cannot be more than the plan fee.');
        setIsUploading(false);
        return;
      }

      if (editingId) {
        const financials = buildMembershipFinancials(
          payload.planPrice,
          existingMember?.amountPaid ?? payload.planPrice
        );

        await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', editingId), {
          ...payload,
          amountPaid: existingMember?.amountPaid ?? financials.amountPaid,
          balanceDue: financials.balanceDue,
          paymentStatus: financials.paymentStatus,
          photoURL: formData.photoURL || '',
          photoPath: formData.photoPath || ''
        });
      } else {
        const initialPaid = formData.initialPaid === '' ? payload.planPrice : Number(formData.initialPaid);
        const financials = buildMembershipFinancials(payload.planPrice, initialPaid);
        const memberRef = await addDoc(collection(db, 'gyms', currentUser.uid, 'members'), {
          ...payload,
          amountPaid: financials.amountPaid,
          balanceDue: financials.balanceDue,
          paymentStatus: financials.paymentStatus,
          created_at: new Date().toISOString()
        });
        targetMemberId = memberRef.id;

        if (financials.amountPaid > 0) {
          await addDoc(collection(db, 'gyms', currentUser.uid, 'payments'), {
            memberId: memberRef.id,
            member_name: payload.name,
            amount: financials.amountPaid,
            method: 'Cash',
            category: 'Membership',
            plan_type: payload.planType,
            immutable: true,
            balance_after: financials.balanceDue,
            payment_phase: 'Initial',
            date: new Date().toISOString()
          });
        }
      }

      if (
        editingId &&
        !photoFile &&
        existingMember?.photoPath &&
        !formData.photoURL
      ) {
        await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', targetMemberId), {
          photoURL: '',
          photoPath: ''
        });

        await deleteObject(ref(storage, existingMember.photoPath)).catch((removeErr) => {
          console.error('Failed to delete previous profile photo:', removeErr);
        });
      }

      if (photoFile && targetMemberId) {
        try {
          const compressedFile = await compressImage(photoFile);
          const photoPath = `member-photos/${currentUser.uid}/${targetMemberId}/profile.jpg`;
          const storageRef = ref(storage, photoPath);
          await uploadBytes(storageRef, compressedFile);
          const photoURL = await getDownloadURL(storageRef);
          
          await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', targetMemberId), {
            photoURL,
            photoPath
          });
        } catch (uploadErr) {
          console.error("Photo upload failed:", uploadErr);
          // Don't block member creation/edit if photo fails
        }
      }

      setIsUploading(false);
      await fetchMembers();
      await fetchPayments();
      closeModal();
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setFormError('Failed to save member.');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    readFileAsDataURL(file)
      .then((source) => openCropper(source))
      .catch((err) => {
        console.error('Photo preview failed:', err);
        setFormError('Failed to load selected image.');
      });

    e.target.value = '';
  };

  const openCropper = (source) => {
    const image = new Image();
    image.onload = () => {
      setPendingPhotoSource(source);
      setCropImageSize({ width: image.width, height: image.height });
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setShowCropModal(true);
    };
    image.onerror = () => {
      setFormError('Failed to load selected image.');
    };
    image.src = source;
  };

  const handleApplyCrop = async () => {
    if (!pendingPhotoSource) return;

    try {
      const croppedFile = await cropImageToFile(pendingPhotoSource, 'profile.jpg', {
        zoom: cropZoom,
        offsetX: cropOffsetX,
        offsetY: cropOffsetY
      });
      const croppedPreview = await readFileAsDataURL(croppedFile);

      setPhotoFile(croppedFile);
      setPhotoPreview(croppedPreview);
      setFormData((current) => ({
        ...current,
        photoURL: croppedPreview
      }));
      setShowCropModal(false);
    } catch (err) {
      console.error('Photo crop failed:', err);
      setFormError('Failed to crop selected image.');
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPendingPhotoSource(null);
    setCropImageSize({ width: 0, height: 0 });
    setShowCropModal(false);
    setShowPhotoViewer(false);
    setFormData(prev => ({ ...prev, photoURL: '', photoPath: '' }));
  };

  const openEdit = (member) => {
    const existingPlanType = member.planType || member.plan || 'Monthly';
    const fallbackPlan = PLAN_OPTIONS[existingPlanType] || PLAN_OPTIONS.Monthly;

    setEditingId(member.id);
    setFormError('');
    setFormData({
      name: member.name,
      phone: member.phone || '',
      gender: member.gender || '',
      age: member.age ?? '',
      planType: existingPlanType,
      planPrice: member.planPrice ?? '',
      initialPaid: '',
      planDuration: Number(member.planDuration || fallbackPlan.durationDays),
      joinDate: member.join_date || new Date().toISOString().split('T')[0],
      photoURL: member.photoURL || '',
      photoPath: member.photoPath || ''
    });
    setPhotoFile(null);
    setPhotoPreview(member.photoURL || null);
    setShowAddModal(true);
  };

  const openRenewModal = (member) => {
    const existingPlanType = member.planType || member.plan || 'Monthly';

    setRenewingMember(member);
    setRenewalData({
      amount: member.planPrice ? String(member.planPrice) : '',
      method: 'Cash',
      planType: existingPlanType,
      planPrice: member.planPrice ? String(member.planPrice) : ''
    });
    setRenewError('');
    setShowRenewModal(true);
  };

  const openHistoryModal = (member) => {
    setSelectedHistoryMember(member);
    setShowHistoryModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      const memberToDelete = members.find(m => m.id === id);
      
      try {
        // Delete the member document from Firestore
        await deleteDoc(doc(db, 'gyms', currentUser.uid, 'members', id));
        
        // Clean up the photo from Storage if it exists
        if (memberToDelete?.photoPath) {
          const photoRef = ref(storage, memberToDelete.photoPath);
          await deleteObject(photoRef).catch((err) => {
            console.error('Failed to delete profile photo from storage:', err);
          });
        }
      } catch (err) {
        console.error('Failed to delete member:', err);
      }
      
      await fetchMembers();
    }
  };

  const handleRenewMembership = async (e) => {
    e.preventDefault();
    if (!renewingMember) return;

    try {
      const selectedPlan = getPlanConfig(renewalData.planType);
      const memberRef = doc(db, 'gyms', currentUser.uid, 'members', renewingMember.id);
      const now = new Date();
      const currentExpiry = new Date(renewingMember.expiry_date);
      const baseDate = currentExpiry < now ? now : currentExpiry;
      const renewedExpiry = new Date(baseDate);
      renewedExpiry.setDate(renewedExpiry.getDate() + Number(selectedPlan.durationDays));
      const renewalPlanFee = normalizeAmount(renewalData.planPrice);
      const renewalAmount = normalizeAmount(renewalData.amount);
      const financials = buildMembershipFinancials(renewalPlanFee, renewalAmount);

      if (renewalPlanFee <= 0) {
        setRenewError('Plan fee must be greater than zero.');
        return;
      }

      if (renewalAmount > renewalPlanFee) {
        setRenewError('Amount received cannot be more than the plan fee.');
        return;
      }

      const confirmation = window.confirm(
        `Confirm ${renewalData.planType.toLowerCase()} renewal for ${renewingMember.name} with fee ${formatCurrency(renewalPlanFee)} and payment ${formatCurrency(renewalAmount)}? This payment cannot be edited later.`
      );

      if (!confirmation) return;

      await addDoc(collection(db, 'gyms', currentUser.uid, 'payments'), {
        memberId: renewingMember.id,
        member_name: renewingMember.name,
        amount: renewalAmount,
        method: renewalData.method,
        category: 'Membership',
        plan_type: renewalData.planType,
        immutable: true,
        balance_after: financials.balanceDue,
        payment_phase: financials.balanceDue > 0 ? 'Partial Renewal' : 'Renewal',
        date: new Date().toISOString()
      });

      await updateDoc(memberRef, {
        plan: renewalData.planType,
        planType: renewalData.planType,
        planDuration: selectedPlan.durationDays,
        planPrice: renewalPlanFee,
        amountPaid: financials.amountPaid,
        balanceDue: financials.balanceDue,
        paymentStatus: financials.paymentStatus,
        expiry_date: renewedExpiry.toISOString().split('T')[0]
      });

      await fetchMembers();
      await fetchPayments();
      closeRenewModal();
    } catch (err) {
      console.error(err);
      setRenewError('Failed to renew membership.');
    }
  };

  const filteredMembers = members.filter((member) => {
    const query = memberSearch.trim().toLowerCase();
    const status = getMembershipStatus(member);
    const matchesStatus = statusFilter === 'all' || status.key === statusFilter;
    if (!matchesStatus) return false;
    if (!query) return true;

    return [
      member.name,
      member.phone,
      member.gender,
      member.age,
      member.plan,
      member.planType,
      member.expiry_date,
      status.label
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const selectedMemberPayments = selectedHistoryMember
    ? payments.filter((payment) => payment.memberId === selectedHistoryMember.id)
    : [];

  const cropPreviewLayout = getCropLayout(
    cropImageSize.width,
    cropImageSize.height,
    CROP_FRAME_SIZE,
    cropZoom,
    cropOffsetX,
    cropOffsetY
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black headline-font italic uppercase tracking-tighter text-white leading-tight">Member Directory</h1>
          <p className="text-xs md:text-base text-zinc-500 font-medium mt-0.5">Manage operations and members</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="w-full md:w-auto bg-primary hover:bg-primary-dim text-on-primary px-6 py-3.5 md:py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Member
          </motion.button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="block md:hidden mb-6 mt-2">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">search</span>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full bg-zinc-950/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none transition-all text-white placeholder-zinc-500 shadow-inner"
              placeholder="Search by name, phone, plan..."
              type="text"
            />
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">filter_list</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-zinc-950/50 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none shadow-inner"
            >
              <option value="all">All Statuses</option>
              <option value="expired">Expired</option>
              <option value="expiring">Expiring</option>
              <option value="active">Active</option>
              <option value="partial">Partial</option>
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:items-center md:justify-end mb-6">
        <div className="w-full max-w-xs">
          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Status Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-primary focus:outline-none transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="expired">Expired</option>
            <option value="expiring">Expiring</option>
            <option value="active">Active</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Member</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Phone</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Details</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Plan</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-center">Status</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Expiry</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {members.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-sm font-medium text-zinc-500">No members registered yet.</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-sm font-medium text-zinc-500">No members match your search.</td></tr>
              ) : (
                <AnimatePresence>
                  {filteredMembers.map((m) => {
                    const status = getMembershipStatus(m);
                    return (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={m.id}
                        className="hover:bg-zinc-800/30 transition-colors group cursor-default"
                      >
                        <td className="py-4 px-6 font-medium text-white flex items-center gap-3">
                          <Avatar photoURL={m.photoURL} name={m.name} size="md" />
                          <span>{m.name}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-zinc-400">
                          <div className="flex items-center">
                            {m.phone}
                            <WhatsAppIcon member={m} />
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-zinc-400">
                          {[m.gender, m.age ? `${m.age} yrs` : ''].filter(Boolean).join(' | ') || '-'}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-zinc-300">
                          <div>{m.planType || m.plan}</div>
                          <div className="text-xs font-medium text-zinc-500">
                            {m.planPrice ? `Rs ${Number(m.planPrice).toLocaleString()}` : 'Price not set'}
                          </div>
                          <div className="text-xs font-medium text-zinc-500">
                            Paid {formatCurrency(m.amountPaid)} | Due {formatCurrency(m.balanceDue)}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-zinc-400">{formatDisplayDate(m.expiry_date)}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex gap-3 justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openHistoryModal(m)} className="text-zinc-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">receipt_long</span> History</button>
                            <button onClick={() => openRenewModal(m)} className="text-primary hover:text-white transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">autorenew</span> Renew</button>
                            <button onClick={() => openEdit(m)} className="text-zinc-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">edit</span> Edit</button>
                            <button onClick={() => handleDelete(m.id)} className="text-error/70 hover:text-error transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">delete</span> Delete</button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {members.length === 0 ? (
          <div className="py-12 text-center text-sm font-medium text-zinc-500">No members registered yet.</div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-sm font-medium text-zinc-500">No members match your search.</div>
        ) : (
          <AnimatePresence>
            {filteredMembers.map((m) => {
              const status = getMembershipStatus(m);
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={m.id}
                  className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 p-4 shadow-lg flex flex-col gap-3.5"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center min-w-0">
                      <Avatar photoURL={m.photoURL} name={m.name} size="lg" className="shrink-0" />
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-black text-white truncate">{m.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-zinc-400 font-bold truncate">{m.phone}</p>
                          <WhatsAppIcon member={m} />
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider shrink-0 ${status.color}`}>{status.label}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 bg-zinc-950/40 p-4 rounded-xl border border-white/5 shadow-inner">
                    <div className="min-w-0 border-r border-white/5 pr-2">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">Plan Details</p>
                      <p className="text-[11px] font-black text-zinc-100 truncate">{m.planType || m.plan}</p>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[10px] font-medium text-zinc-400 flex justify-between"><span>Fee:</span> <span className="text-zinc-200">{formatCurrency(m.planPrice)}</span></p>
                        <p className="text-[10px] font-medium text-zinc-400 flex justify-between"><span>Paid:</span> <span className="text-zinc-200">{formatCurrency(m.amountPaid)}</span></p>
                        <p className="text-[10px] font-bold text-primary flex justify-between border-t border-white/5 pt-1 mt-1"><span>Due:</span> <span>{formatCurrency(m.balanceDue)}</span></p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">Timeline & Profile</p>
                      <p className="text-[11px] font-black text-zinc-100 truncate">Exp: {formatDisplayDate(m.expiry_date)}</p>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[10px] font-medium text-zinc-400 flex justify-between"><span>Joined:</span> <span className="text-zinc-200">{formatDisplayDate(m.join_date)}</span></p>
                        <p className="text-[10px] font-medium text-zinc-400 flex justify-between"><span>Gender:</span> <span className="text-zinc-200">{m.gender || '-'}</span></p>
                        <p className="text-[10px] font-medium text-zinc-400 flex justify-between"><span>Age:</span> <span className="text-zinc-200">{m.age ? `${m.age}y` : '-'}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-1">
                    <button onClick={() => handleDelete(m.id)} className="p-3 bg-error/10 text-error hover:bg-error hover:text-white rounded-xl transition-all border border-error/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                    <button onClick={() => openEdit(m)} className="p-3 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button onClick={() => openHistoryModal(m)} className="p-3 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                    </button>
                    <button onClick={() => openRenewModal(m)} className="py-3 px-2 text-primary hover:text-zinc-950 hover:bg-primary bg-primary/10 rounded-xl transition-all border border-primary/20 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">autorenew</span> Renew
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] overflow-y-auto p-4 py-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-5 md:p-8 rounded-2xl w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={closeModal} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-6 text-white uppercase">{editingId ? 'Edit Member' : 'Add New Member'}</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-col items-center justify-center mb-6">
                  <div className="relative mb-3 group">
                    <button
                      type="button"
                      onClick={() => photoPreview && setShowPhotoViewer(true)}
                      className="rounded-full"
                    >
                      <Avatar photoURL={photoPreview} name={formData.name || 'New Member'} size="xl" className="border-4 border-zinc-800" />
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                    </button>
                    {photoPreview && (
                      <button type="button" onClick={removePhoto} className="absolute top-0 right-0 bg-zinc-900 border border-zinc-700 rounded-full p-1.5 text-error hover:bg-error/20 hover:text-error transition-colors shadow-lg translate-x-1/4 -translate-y-1/4">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                  <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Profile Photo (Optional)</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10"
                    >
                      Upload From Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
                    >
                      Open Camera
                    </button>
                  </div>
                  {photoPreview && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPhotoViewer(true)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10"
                      >
                        View Image
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Full Name</label>
                  <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      maxLength="10"
                      value={formData.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, phone: val });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                      placeholder="10-digit number"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Used for future login and WhatsApp reminders.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Gender</label>
                    <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                      <option value="">Not specified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Age</label>
                    <input type="number" min="0" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Select Plan</label>
                    <select value={formData.planType} onChange={(e) => handlePlanTypeChange(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                      {Object.keys(PLAN_OPTIONS).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Plan Price</label>
                    <input type="number" min="0" required value={formData.planPrice} onChange={(e) => setFormData({ ...formData, planPrice: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Plan Duration</label>
                    <input readOnly value={PLAN_OPTIONS[formData.planType].label} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-300 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Start Date</label>
                    <input type="date" required value={formData.joinDate} onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  {!editingId && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount Received Now</label>
                      <input type="number" min="0" value={formData.initialPaid} onChange={(e) => setFormData({ ...formData, initialPaid: e.target.value })} placeholder="Leave blank for full payment" className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {editingId && <div />}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Expiry Date</label>
                    <input readOnly value={formatDisplayDate(computedExpiryDate)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-300 outline-none" />
                  </div>
                </div>

                {formError && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{formError}</div>}

                <div className="pt-4 pb-20">
                  <button type="submit" disabled={isUploading} className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                    {isUploading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                    {isUploading ? 'Saving...' : editingId ? 'Save Changes' : 'Confirm Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCropModal && pendingPhotoSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] overflow-y-auto p-4 py-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="mx-auto w-full max-w-xl rounded-2xl border border-white/5 bg-surface-container-highest p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider text-white">Crop Photo</h2>
                  <p className="mt-1 text-sm text-zinc-400">Adjust the image inside the square frame, then save it.</p>
                </div>
                <button onClick={() => setShowCropModal(false)} className="text-zinc-500 hover:text-white p-2 flex">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="relative h-72 w-72 overflow-hidden rounded-3xl border-2 border-primary bg-zinc-950 shadow-2xl">
                  {/* Image container with mask */}
                  <img
                    src={pendingPhotoSource}
                    alt="Crop preview"
                    className="absolute select-none transition-all duration-75"
                    style={{
                      width: `${cropPreviewLayout.width}px`,
                      height: `${cropPreviewLayout.height}px`,
                      left: `${cropPreviewLayout.left}px`,
                      top: `${cropPreviewLayout.top}px`
                    }}
                  />
                  {/* Visual Crop Frame Overlay */}
                  <div className="pointer-events-none absolute inset-0 ring-[60px] ring-black/40 rounded-3xl" />
                  <div className="pointer-events-none absolute inset-0 border-2 border-white/20 rounded-3xl shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]" />
                </div>
              </div>

              <div className="mt-8 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Zoom</label>
                    <span className="text-[10px] font-bold text-primary">{Math.round(cropZoom * 100)}%</span>
                  </div>
                  <input type="range" min="1" max="5" step="0.05" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Left / Right</label>
                    <input type="range" min="-100" max="100" step="1" value={cropOffsetX} onChange={(e) => setCropOffsetX(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Up / Down</label>
                    <input type="range" min="-100" max="100" step="1" value={cropOffsetY} onChange={(e) => setCropOffsetY(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowCropModal(false)} className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-700">
                  Cancel
                </button>
                <button onClick={handleApplyCrop} className="flex-[2] rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-zinc-950 transition-colors hover:bg-primary-dim">
                  Save Crop
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPhotoViewer && photoPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={() => setShowPhotoViewer(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setShowPhotoViewer(false)} className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
              <img src={photoPreview} alt="Member preview" className="max-h-[82vh] w-full rounded-2xl object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-950 p-5 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase text-white tracking-wider">Take Photo</h3>
                <button onClick={() => setShowCamera(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowCamera(false)} className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors">Cancel</button>
                <button onClick={capturePhoto} className="flex-[2] py-3 bg-primary text-zinc-950 font-black uppercase tracking-widest rounded-xl hover:bg-primary-dim transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                  Capture
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRenewModal && renewingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-5 md:p-8 rounded-2xl w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={closeRenewModal} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-2 text-white uppercase">Renew Membership</h2>
              <p className="text-sm text-zinc-400 mb-6">{renewingMember.name}</p>

              <form onSubmit={handleRenewMembership} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan</p>
                    <select
                      value={renewalData.planType}
                      onChange={(e) => setRenewalData({ ...renewalData, planType: e.target.value })}
                      className="mt-1 w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm font-bold text-white outline-none transition-all"
                    >
                      {Object.keys(PLAN_OPTIONS).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                    </select>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Renewal Period</p>
                    <p className="mt-1 text-sm font-bold text-white">{getPlanConfig(renewalData.planType).label}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Plan Fee</label>
                  <input type="number" min="1" required value={renewalData.planPrice} onChange={(e) => setRenewalData({ ...renewalData, planPrice: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount Received</label>
                  <input type="number" min="0" required value={renewalData.amount} onChange={(e) => setRenewalData({ ...renewalData, amount: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Method</label>
                  <select value={renewalData.method} onChange={(e) => setRenewalData({ ...renewalData, method: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                  </select>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">New Expiry</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {(() => {
                      const selectedPlan = getPlanConfig(renewalData.planType);
                      const now = new Date();
                      const currentExpiry = new Date(renewingMember.expiry_date);
                      const baseDate = currentExpiry < now ? now : currentExpiry;
                      const renewedExpiry = new Date(baseDate);
                      renewedExpiry.setDate(renewedExpiry.getDate() + Number(selectedPlan.durationDays));
                      return formatDisplayDate(renewedExpiry);
                    })()}
                  </p>
                  <p className="mt-2 text-xs text-primary/80">Balance after renewal: {formatCurrency(buildMembershipFinancials(renewalData.planPrice, renewalData.amount).balanceDue)}</p>
                </div>
                {renewError && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{renewError}</div>}
                <div className="pt-2 pb-20">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    Confirm Renewal
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistoryModal && selectedHistoryMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] overflow-y-auto p-4 py-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-5 md:p-8 rounded-2xl w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={closeHistoryModal} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-2 text-white uppercase">Payment History</h2>
              <p className="text-sm text-zinc-400 mb-6">{selectedHistoryMember.name}</p>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {selectedMemberPayments.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-zinc-950/50 px-4 py-6 text-sm text-zinc-500">
                    No payments recorded for this member yet.
                  </div>
                ) : (
                  selectedMemberPayments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-white/5 bg-zinc-950/50 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{payment.category || 'Membership'}{payment.plan_type ? ` | ${payment.plan_type}` : ''}{payment.supplement_name ? ` | ${payment.supplement_name}` : ''}{payment.payment_phase ? ` | ${payment.payment_phase}` : ''}</p>
                        <p className="mt-1 text-xs text-zinc-400">{formatDisplayDate(payment.date)} | {payment.method}</p>
                        {payment.balance_after != null && <p className="mt-1 text-[11px] text-zinc-500">Balance after: {formatCurrency(payment.balance_after)}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">{formatCurrency(payment.amount)}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{payment.immutable === false ? 'Open' : 'Locked'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
