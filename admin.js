const config = window.SITE_CONFIG || {};
const statusMessage = document.getElementById('adminStatus');
const setupNotice = document.getElementById('setupNotice');
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const propertyForm = document.getElementById('propertyForm');
const leadsList = document.getElementById('leadsList');
const propertiesList = document.getElementById('propertiesList');
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const interestLabels = { buy: 'شراء منزل', sell: 'بيع منزل', other: 'استفسار آخر' };
const statusLabels = { available: 'متاح', under_contract: 'تحت العقد', closed: 'تم الإغلاق' };

let client = null;
let leads = [];
let properties = [];
let editingProperty = null;

function showStatus(message, kind) {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind || 'info';
}

function clearStatus() {
  statusMessage.textContent = '';
  delete statusMessage.dataset.kind;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function updateStats() {
  document.getElementById('leadStat').textContent = String(leads.length);
  document.getElementById('unreadStat').textContent = String(leads.filter(lead => !lead.is_read).length);
  document.getElementById('publishedStat').textContent = String(properties.filter(property => property.is_published).length);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'تاريخ غير متاح';
  return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderLeads() {
  leadsList.replaceChildren();
  updateStats();

  if (!leads.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty-state';
    empty.textContent = 'لا توجد رسائل حتى الآن.';
    leadsList.append(empty);
    return;
  }

  leads.forEach(lead => {
    const card = document.createElement('article');
    card.className = `admin-record lead-record${lead.is_read ? '' : ' is-unread'}`;

    const heading = document.createElement('div');
    heading.className = 'admin-record-heading';
    const title = document.createElement('h3');
    title.textContent = lead.name;
    const badge = document.createElement('span');
    badge.className = `admin-badge${lead.is_read ? '' : ' is-new'}`;
    badge.textContent = lead.is_read ? 'مقروءة' : 'جديدة';
    heading.append(title, badge);

    const meta = document.createElement('p');
    meta.className = 'admin-record-meta';
    meta.textContent = `${formatDate(lead.created_at)} · ${interestLabels[lead.interest] || 'استفسار عام'}`;

    const contacts = document.createElement('div');
    contacts.className = 'admin-contact-links';
    const email = document.createElement('a');
    email.href = `mailto:${encodeURIComponent(lead.email)}`;
    email.textContent = lead.email;
    contacts.append(email);
    if (lead.phone) {
      const phone = document.createElement('a');
      phone.href = `tel:${String(lead.phone).replace(/[^\d+]/g, '')}`;
      phone.textContent = lead.phone;
      contacts.append(phone);
    }

    const message = document.createElement('p');
    message.className = 'admin-record-message';
    message.textContent = lead.message || 'لم يكتب العميل رسالة إضافية.';

    const actions = document.createElement('div');
    actions.className = 'admin-record-actions';
    actions.append(
      createButton(lead.is_read ? 'تمييز كغير مقروءة' : 'تحديد كمقروءة', 'admin-secondary-button', () => toggleLeadRead(lead)),
      createButton('حذف الرسالة', 'admin-danger-button', () => deleteLead(lead))
    );

    card.append(heading, meta, contacts, message, actions);
    leadsList.append(card);
  });
}

function renderProperties() {
  propertiesList.replaceChildren();
  updateStats();

  if (!properties.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty-state';
    empty.textContent = 'لا توجد عقارات بعد. أضف أول عقار من النموذج.';
    propertiesList.append(empty);
    return;
  }

  properties.forEach(property => {
    const card = document.createElement('article');
    card.className = 'admin-record admin-property-record';

    if (property.image_url) {
      const image = document.createElement('img');
      image.className = 'admin-property-thumb';
      image.src = property.image_url;
      image.alt = property.title;
      image.loading = 'lazy';
      card.append(image);
    }

    const details = document.createElement('div');
    details.className = 'admin-property-details';
    const heading = document.createElement('div');
    heading.className = 'admin-record-heading';
    const title = document.createElement('h3');
    title.textContent = property.title;
    const badge = document.createElement('span');
    badge.className = `admin-badge${property.is_published ? ' is-published' : ''}`;
    badge.textContent = property.is_published ? 'منشور' : 'مسودة';
    heading.append(title, badge);

    const location = document.createElement('p');
    location.className = 'admin-record-meta';
    location.textContent = `${property.location} · ${statusLabels[property.status] || property.status}`;
    const description = document.createElement('p');
    description.className = 'admin-record-message';
    description.textContent = property.description || 'لا يوجد تعليق مضاف.';

    const actions = document.createElement('div');
    actions.className = 'admin-record-actions';
    actions.append(
      createButton('تعديل', 'admin-secondary-button', () => beginEdit(property)),
      createButton(property.is_published ? 'إخفاء من الموقع' : 'نشر على الموقع', 'admin-secondary-button', () => togglePropertyPublished(property)),
      createButton('حذف العقار', 'admin-danger-button', () => deleteProperty(property))
    );

    details.append(heading, location, description, actions);
    card.append(details);
    propertiesList.append(card);
  });
}

async function loadAdminData() {
  showStatus('جارٍ تحميل بيانات لوحة التحكم...', 'info');
  const [leadsResult, propertiesResult] = await Promise.all([
    client.from('leads').select('id,name,email,phone,interest,message,is_read,created_at').order('created_at', { ascending: false }),
    client.from('properties').select('id,slug,title,location,status,image_url,description,is_published,created_at').order('created_at', { ascending: false })
  ]);
  if (leadsResult.error) throw leadsResult.error;
  if (propertiesResult.error) throw propertiesResult.error;

  leads = leadsResult.data || [];
  properties = propertiesResult.data || [];
  renderLeads();
  renderProperties();
  clearStatus();
}

async function authorizeUser(user) {
  const { data, error } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    await client.auth.signOut();
    loginView.hidden = false;
    dashboardView.hidden = true;
    showStatus('هذا الحساب لا يملك صلاحية الإدارة. تواصل مع مالك الموقع.', 'error');
    return;
  }

  loginView.hidden = true;
  dashboardView.hidden = false;
  try {
    await loadAdminData();
  } catch (error) {
    showStatus(`تعذّر تحميل البيانات: ${error.message}`, 'error');
  }
}

async function toggleLeadRead(lead) {
  const { error } = await client.from('leads').update({ is_read: !lead.is_read }).eq('id', lead.id);
  if (error) {
    showStatus(`تعذّر تحديث الرسالة: ${error.message}`, 'error');
    return;
  }
  await refreshLeads();
}

async function deleteLead(lead) {
  if (!window.confirm(`هل تريد حذف رسالة ${lead.name} نهائيًا؟`)) return;
  const { error } = await client.from('leads').delete().eq('id', lead.id);
  if (error) {
    showStatus(`تعذّر حذف الرسالة: ${error.message}`, 'error');
    return;
  }
  showStatus('تم حذف الرسالة.', 'success');
  await refreshLeads();
}

async function refreshLeads() {
  const { data, error } = await client
    .from('leads')
    .select('id,name,email,phone,interest,message,is_read,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    showStatus(`تعذّر تحديث الرسائل: ${error.message}`, 'error');
    return;
  }
  leads = data || [];
  renderLeads();
  clearStatus();
}

async function refreshProperties() {
  const { data, error } = await client
    .from('properties')
    .select('id,slug,title,location,status,image_url,description,is_published,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    showStatus(`تعذّر تحديث العقارات: ${error.message}`, 'error');
    return;
  }
  properties = data || [];
  renderProperties();
  clearStatus();
}

function beginEdit(property) {
  editingProperty = property;
  propertyForm.elements.title.value = property.title;
  propertyForm.elements.location.value = property.location;
  propertyForm.elements.status.value = property.status;
  propertyForm.elements.description.value = property.description || '';
  propertyForm.elements.is_published.checked = property.is_published;
  propertyForm.elements.image.value = '';
  document.getElementById('propertyFormTitle').textContent = 'تعديل العقار';
  document.getElementById('savePropertyButton').textContent = 'حفظ التعديلات';
  document.getElementById('cancelEditButton').hidden = false;

  const currentImageNote = document.getElementById('currentImageNote');
  currentImageNote.replaceChildren();
  currentImageNote.hidden = !property.image_url;
  if (property.image_url) {
    const image = document.createElement('img');
    image.src = property.image_url;
    image.alt = `الصورة الحالية: ${property.title}`;
    currentImageNote.append(image, document.createTextNode('اختر صورة جديدة لاستبدال الصورة الحالية.'));
  }
  propertyForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetPropertyForm() {
  editingProperty = null;
  propertyForm.reset();
  propertyForm.elements.is_published.checked = true;
  document.getElementById('propertyFormTitle').textContent = 'إضافة عقار';
  document.getElementById('savePropertyButton').textContent = 'حفظ العقار';
  document.getElementById('cancelEditButton').hidden = true;
  document.getElementById('currentImageNote').replaceChildren();
  document.getElementById('currentImageNote').hidden = true;
}

function createSlug(title) {
  const slug = title.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `property-${Date.now()}`;
}

async function uploadPropertyImage(file) {
  if (!allowedImageTypes.includes(file.type)) {
    throw new Error('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP أو AVIF.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('حجم الصورة أكبر من 8 ميجابايت.');
  }

  const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const uniqueId = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `properties/${uniqueId}.${extension}`;
  const { data, error } = await client.storage
    .from('property-images')
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
  if (error) throw error;
  return { path: data.path, url: client.storage.from('property-images').getPublicUrl(data.path).data.publicUrl };
}

async function saveProperty(event) {
  event.preventDefault();
  if (!propertyForm.reportValidity()) return;

  const saveButton = document.getElementById('savePropertyButton');
  saveButton.disabled = true;
  clearStatus();
  let uploadedPath = null;
  try {
    const formData = new FormData(propertyForm);
    const imageFile = formData.get('image');
    let imageUrl = editingProperty ? editingProperty.image_url : '';

    if (imageFile instanceof File && imageFile.size > 0) {
      const uploaded = await uploadPropertyImage(imageFile);
      imageUrl = uploaded.url;
      uploadedPath = uploaded.path;
    } else if (!editingProperty) {
      throw new Error('اختر صورة للعقار قبل الحفظ.');
    }

    const title = String(formData.get('title')).trim();
    const propertyData = {
      slug: editingProperty ? editingProperty.slug : createSlug(title),
      title,
      location: String(formData.get('location')).trim(),
      status: String(formData.get('status')),
      image_url: imageUrl,
      description: String(formData.get('description') || '').trim() || null,
      is_published: formData.get('is_published') === 'on'
    };

    const result = editingProperty
      ? await client.from('properties').update(propertyData).eq('id', editingProperty.id)
      : await client.from('properties').insert(propertyData);
    if (result.error) throw result.error;

    showStatus(editingProperty ? 'تم تحديث العقار.' : 'تمت إضافة العقار.', 'success');
    resetPropertyForm();
    await refreshProperties();
  } catch (error) {
    if (uploadedPath) {
      const { error: cleanupError } = await client.storage.from('property-images').remove([uploadedPath]);
      if (cleanupError) console.error('Could not remove the image uploaded before the property save failed:', cleanupError);
    }
    showStatus(`تعذّر حفظ العقار: ${error.message}`, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

async function togglePropertyPublished(property) {
  const { error } = await client
    .from('properties')
    .update({ is_published: !property.is_published })
    .eq('id', property.id);
  if (error) {
    showStatus(`تعذّر تغيير حالة النشر: ${error.message}`, 'error');
    return;
  }
  showStatus(property.is_published ? 'تم إخفاء العقار من الموقع.' : 'تم نشر العقار على الموقع.', 'success');
  await refreshProperties();
}

async function deleteProperty(property) {
  if (!window.confirm(`هل تريد حذف "${property.title}" من الموقع نهائيًا؟`)) return;
  const { error } = await client.from('properties').delete().eq('id', property.id);
  if (error) {
    showStatus(`تعذّر حذف العقار: ${error.message}`, 'error');
    return;
  }
  if (editingProperty && editingProperty.id === property.id) resetPropertyForm();
  showStatus('تم حذف العقار.', 'success');
  await refreshProperties();
}

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  setupNotice.hidden = false;
  loginView.hidden = true;
} else if (!window.supabase || !window.supabase.createClient) {
  setupNotice.hidden = false;
  setupNotice.querySelector('p').textContent = 'تعذّر تحميل مكتبة Supabase. تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة.';
  loginView.hidden = true;
} else {
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    clearStatus();
    const formData = new FormData(loginForm);
    const { data, error } = await client.auth.signInWithPassword({
      email: String(formData.get('email')).trim(),
      password: String(formData.get('password'))
    });
    submitButton.disabled = false;
    if (error) {
      showStatus(`تعذّر تسجيل الدخول: ${error.message}`, 'error');
      return;
    }
    try {
      await authorizeUser(data.user);
    } catch (authorizationError) {
      showStatus(`تعذّر التحقق من صلاحيات الحساب: ${authorizationError.message}`, 'error');
    }
  });

  document.getElementById('signOutButton').addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      showStatus(`تعذّر تسجيل الخروج: ${error.message}`, 'error');
      return;
    }
    dashboardView.hidden = true;
    loginView.hidden = false;
    resetPropertyForm();
    showStatus('تم تسجيل الخروج.', 'success');
  });

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.hidden = panel.id !== tab.dataset.adminTab;
      });
    });
  });

  document.getElementById('refreshLeadsButton').addEventListener('click', refreshLeads);
  document.getElementById('refreshPropertiesButton').addEventListener('click', refreshProperties);
  document.getElementById('cancelEditButton').addEventListener('click', resetPropertyForm);
  propertyForm.addEventListener('submit', saveProperty);

  (async () => {
    showStatus('جارٍ التحقق من الجلسة...', 'info');
    const { data, error } = await client.auth.getSession();
    if (error) {
      showStatus(`تعذّر التحقق من الجلسة: ${error.message}`, 'error');
      return;
    }
    if (data.session) {
      try {
        await authorizeUser(data.session.user);
      } catch (authorizationError) {
        showStatus(`تعذّر التحقق من صلاحيات الحساب: ${authorizationError.message}`, 'error');
      }
    } else {
      clearStatus();
    }
  })();
}
