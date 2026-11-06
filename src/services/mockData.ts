import { 
  Customer, Supplier, Employee, AttendanceRecord, VisitorRecord,
  Product, PurchaseInvoice, SalesInvoice, InstallmentAccount, 
  Voucher, LedgerEntry, AccountHead, ChequeRecord, Target, AuditLog, ShowroomSettings, User
} from '../types/erp';

export const initialSettings: ShowroomSettings = {
  showroomName: 'Al-Madina Electronics & Appliances',
  ownerName: 'Muhammad Tariq Khan',
  phone: '+92 300 8472910',
  whatsapp: '+92 321 9845120',
  email: 'info@almadinaelectronics.pk',
  address: 'Main Commercial Avenue, Shop # 14-18, Electronics Market',
  city: 'Lahore, Pakistan',
  currency: 'PKR',
  currencySymbol: '₨',
  ntn: '7392819-4',
  strn: '32-77-8761-239-11',
  invoicePrefix: 'INV-',
  purchasePrefix: 'PINV-',
  receiptPrefix: 'RCT-',
  defaultTaxRate: 0,
  defaultMarkupRate: 20,
  printFormat: 'A4',
  invoiceFooterNote: 'Thank you for choosing Al-Madina Electronics! Goods once sold carry official company warranty.'
};

export const initialUsers: User[] = [
  {
    id: 'usr-1',
    name: 'Muhammad Tariq Khan',
    email: 'tariq@almadinaelectronics.pk',
    role: 'Owner',
    phone: '+92 300 8472910',
    active: true,
    lastLogin: '2026-11-06 08:30 AM'
  },
  {
    id: 'usr-2',
    name: 'Kamran Ashraf',
    email: 'kamran@almadinaelectronics.pk',
    role: 'Manager',
    phone: '+92 321 4455667',
    active: true,
    lastLogin: '2026-11-06 09:15 AM'
  },
  {
    id: 'usr-3',
    name: 'Bilal Hussain',
    email: 'bilal@almadinaelectronics.pk',
    role: 'Cashier',
    phone: '+92 333 9988776',
    active: true,
    lastLogin: '2026-11-06 09:00 AM'
  },
  {
    id: 'usr-4',
    name: 'Asim Raza',
    email: 'asim@almadinaelectronics.pk',
    role: 'Accountant',
    phone: '+92 301 7766554',
    active: true,
    lastLogin: '2026-11-06 09:45 AM'
  },
  {
    id: 'usr-5',
    name: 'Shahid Mehmood',
    email: 'shahid@almadinaelectronics.pk',
    role: 'RecoveryOfficer',
    phone: '+92 345 1122334',
    active: true,
    lastLogin: '2026-11-06 10:10 AM'
  },
  {
    id: 'usr-6',
    name: 'Zeeshan Ali',
    email: 'zeeshan@almadinaelectronics.pk',
    role: 'StockManager',
    phone: '+92 312 8877665',
    active: true,
    lastLogin: '2026-11-06 09:30 AM'
  },
  {
    id: 'usr-7',
    name: 'Faizan Sheikh',
    email: 'faizan@almadinaelectronics.pk',
    role: 'Receptionist',
    phone: '+92 308 5544332',
    active: true,
    lastLogin: '2026-11-06 08:45 AM'
  }
];

export const initialCustomers: Customer[] = [
  {
    id: 'CUST-101',
    name: 'Sheikh Abdul Rehman',
    fatherName: 'Abdul Ghaffar',
    phone: '0300-4829102',
    whatsapp: '0300-4829102',
    cnic: '35202-1849201-3',
    email: 'rehman.traders@gmail.com',
    address: 'House # 45, Street 8, Model Town',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 75000,
    creditLimit: 300000,
    customerType: 'Installment',
    createdAt: '2026-08-15'
  },
  {
    id: 'CUST-102',
    name: 'Chaudhry Nadeem Akhtar',
    fatherName: 'Akhtar Ali',
    phone: '0321-7654321',
    whatsapp: '0321-7654321',
    cnic: '35201-9876543-1',
    email: 'nadeem.akhtar@yahoo.com',
    address: 'Plaza 12, Gulberg III',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 140000,
    creditLimit: 500000,
    customerType: 'Installment',
    createdAt: '2026-09-02'
  },
  {
    id: 'CUST-103',
    name: 'Dr. Ayesha Siddiqa',
    fatherName: 'Dr. Siddiq Ahmed',
    phone: '0333-5566778',
    whatsapp: '0333-5566778',
    cnic: '35202-4433221-8',
    email: 'ayesha.siddiqa@hospital.org',
    address: 'Apartment 4B, Askari 10',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 0,
    creditLimit: 200000,
    customerType: 'Retail',
    createdAt: '2026-09-20'
  },
  {
    id: 'CUST-104',
    name: 'Haji Ghulam Rasool',
    fatherName: 'Ghulam Qadir',
    phone: '0302-8877661',
    whatsapp: '0302-8877661',
    cnic: '35401-1234567-9',
    email: 'haji.rasool@gmail.com',
    address: 'Near Jamia Masjid, Shahdara',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 45000,
    creditLimit: 150000,
    customerType: 'Credit',
    createdAt: '2026-10-05'
  },
  {
    id: 'CUST-105',
    name: 'Malik Waqas Umar',
    fatherName: 'Umar Hayat',
    phone: '0315-9988774',
    whatsapp: '0315-9988774',
    cnic: '35200-5566778-5',
    email: 'waqas.umar@outlook.com',
    address: 'Street 3, Phase 5 DHA',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 0,
    creditLimit: 400000,
    customerType: 'Retail',
    createdAt: '2026-10-18'
  }
];

export const initialSuppliers: Supplier[] = [
  {
    id: 'SUP-201',
    companyName: 'Dawlance Electronics Pakistan',
    contactPerson: 'Zubair Butt (Sales Mgr)',
    phone: '0300-8451299',
    whatsapp: '0300-8451299',
    email: 'distribution@dawlance.com.pk',
    address: 'Dawlance Warehouse Hub, Multan Road',
    city: 'Lahore',
    ntn: '0819283-9',
    openingBalance: 0,
    currentBalance: 850000,
    paymentTerms: '30 Days Credit',
    createdAt: '2026-01-10'
  },
  {
    id: 'SUP-202',
    companyName: 'Haier Appliances Official Dist.',
    contactPerson: 'Engr. Imran Farooq',
    phone: '0321-4455889',
    whatsapp: '0321-4455889',
    email: 'imran.farooq@haier.com.pk',
    address: 'Haier Industrial Estate, Raiwind Road',
    city: 'Lahore',
    ntn: '1928374-2',
    openingBalance: 0,
    currentBalance: 1200000,
    paymentTerms: '15 Days Credit',
    createdAt: '2026-02-15'
  },
  {
    id: 'SUP-203',
    companyName: 'Gree DWP Group Corp',
    contactPerson: 'Salman Khalid',
    phone: '0333-6655443',
    whatsapp: '0333-6655443',
    email: 'dwp.corporate@dwpgroup.com',
    address: 'DWP Complex, Jail Road',
    city: 'Lahore',
    ntn: '2837465-1',
    openingBalance: 0,
    currentBalance: 450000,
    paymentTerms: '20 Days Credit',
    createdAt: '2026-03-01'
  },
  {
    id: 'SUP-204',
    companyName: 'Samsung Electronics Distributor',
    contactPerson: 'M. Ali Raza',
    phone: '0301-9988112',
    whatsapp: '0301-9988112',
    email: 'sales@samsungdist.pk',
    address: 'Hafeez Centre 4th Floor',
    city: 'Lahore',
    ntn: '3748592-0',
    openingBalance: 0,
    currentBalance: 980000,
    paymentTerms: 'Immediate / 7 Days',
    createdAt: '2026-03-20'
  },
  {
    id: 'SUP-205',
    companyName: 'PEL Pak Elektron Limited',
    contactPerson: 'Khurram Shahzad',
    phone: '0345-7788990',
    whatsapp: '0345-7788990',
    email: 'pel.dealers@pel.com.pk',
    address: '14-KM Ferozepur Road',
    city: 'Lahore',
    ntn: '4859201-7',
    openingBalance: 0,
    currentBalance: 620000,
    paymentTerms: '30 Days Credit',
    createdAt: '2026-04-10'
  }
];

export const initialEmployees: Employee[] = [
  {
    id: 'EMP-01',
    name: 'Muhammad Tariq Khan',
    phone: '0300-8472910',
    cnic: '35202-1122334-1',
    designation: 'General Manager & Owner',
    department: 'Executive',
    joiningDate: '2020-01-01',
    salary: 250000,
    status: 'Active',
    shift: 'General (09:00 AM - 09:00 PM)'
  },
  {
    id: 'EMP-02',
    name: 'Kamran Ashraf',
    phone: '0321-4455667',
    cnic: '35201-2233445-3',
    designation: 'Showroom Floor Manager',
    department: 'Sales & Operations',
    joiningDate: '2022-03-15',
    salary: 85000,
    status: 'Active',
    shift: 'Morning (09:00 AM - 06:00 PM)'
  },
  {
    id: 'EMP-03',
    name: 'Bilal Hussain',
    phone: '0333-9988776',
    cnic: '35202-3344556-5',
    designation: 'Head Cashier',
    department: 'Accounts & Billing',
    joiningDate: '2023-01-10',
    salary: 55000,
    status: 'Active',
    shift: 'General (09:30 AM - 08:30 PM)'
  },
  {
    id: 'EMP-04',
    name: 'Shahid Mehmood',
    phone: '0345-1122334',
    cnic: '35200-4455667-7',
    designation: 'Senior Recovery Officer',
    department: 'Installment & Recovery',
    joiningDate: '2023-06-01',
    salary: 50000,
    status: 'Active',
    shift: 'Field & Showroom'
  },
  {
    id: 'EMP-05',
    name: 'Zeeshan Ali',
    phone: '0312-8877665',
    cnic: '35401-5566778-9',
    designation: 'Warehouse & Stock Incharge',
    department: 'Inventory',
    joiningDate: '2023-08-15',
    salary: 45000,
    status: 'Active',
    shift: 'Morning (09:00 AM - 06:00 PM)'
  },
  {
    id: 'EMP-06',
    name: 'Faizan Sheikh',
    phone: '0308-5544332',
    cnic: '35202-6677889-1',
    designation: 'Front Desk & Receptionist',
    department: 'Customer Care',
    joiningDate: '2024-02-01',
    salary: 38000,
    status: 'Active',
    shift: 'General (09:00 AM - 08:00 PM)'
  }
];

export const initialAttendance: AttendanceRecord[] = [
  {
    id: 'ATT-101',
    employeeId: 'EMP-01',
    employeeName: 'Muhammad Tariq Khan',
    date: '2026-11-06',
    checkInTime: '08:45 AM',
    checkOutTime: '',
    status: 'Present',
    workingHours: 8,
    notes: 'On time'
  },
  {
    id: 'ATT-102',
    employeeId: 'EMP-02',
    employeeName: 'Kamran Ashraf',
    date: '2026-11-06',
    checkInTime: '09:05 AM',
    checkOutTime: '',
    status: 'Present',
    workingHours: 7.5,
    notes: 'Morning briefing conducted'
  },
  {
    id: 'ATT-103',
    employeeId: 'EMP-03',
    employeeName: 'Bilal Hussain',
    date: '2026-11-06',
    checkInTime: '09:12 AM',
    checkOutTime: '',
    status: 'Late',
    workingHours: 7.3,
    notes: 'Traffic delay'
  },
  {
    id: 'ATT-104',
    employeeId: 'EMP-04',
    employeeName: 'Shahid Mehmood',
    date: '2026-11-06',
    checkInTime: '09:40 AM',
    checkOutTime: '',
    status: 'Late',
    workingHours: 6.8,
    notes: 'Morning recovery visits'
  },
  {
    id: 'ATT-105',
    employeeId: 'EMP-05',
    employeeName: 'Zeeshan Ali',
    date: '2026-11-06',
    checkInTime: '08:55 AM',
    checkOutTime: '',
    status: 'Present',
    workingHours: 7.8,
    notes: 'Stock intake inspection'
  },
  {
    id: 'ATT-106',
    employeeId: 'EMP-06',
    employeeName: 'Faizan Sheikh',
    date: '2026-11-06',
    checkInTime: '08:50 AM',
    checkOutTime: '',
    status: 'Present',
    workingHours: 8,
    notes: 'Reception desk opened'
  }
];

export const initialVisitors: VisitorRecord[] = [
  {
    id: 'VIS-001',
    name: 'Muhammad Rizwan',
    phone: '0300-1234567',
    cnic: '35201-1122334-5',
    purpose: 'Product Inquiry',
    personToMeet: 'Kamran Ashraf (Manager)',
    entryDate: '2026-11-06',
    entryTime: '10:15 AM',
    exitTime: '10:50 AM',
    status: 'Checked Out',
    remarks: 'Inquired about Haier 1.5 Ton DC Inverter Thunder T3',
    createdBy: 'Faizan Sheikh'
  },
  {
    id: 'VIS-002',
    name: 'Usman Ghani',
    phone: '0321-9876543',
    cnic: '35202-5544332-1',
    purpose: 'Installment Inquiry',
    personToMeet: 'Shahid Mehmood (Recovery)',
    entryDate: '2026-11-06',
    entryTime: '11:30 AM',
    exitTime: '12:15 PM',
    status: 'Checked Out',
    remarks: 'Submitted docs for Dawlance 91996 Refrigerator on 12-month installment',
    createdBy: 'Faizan Sheikh'
  },
  {
    id: 'VIS-003',
    name: 'Chaudhry Nadeem Akhtar',
    phone: '0321-7654321',
    purpose: 'Installment Payment',
    personToMeet: 'Bilal Hussain (Cashier)',
    entryDate: '2026-11-06',
    entryTime: '01:10 PM',
    exitTime: '',
    status: 'Inside',
    remarks: 'Paying monthly installment for Samsung 65" QLED TV',
    createdBy: 'Faizan Sheikh'
  },
  {
    id: 'VIS-004',
    name: 'Hamza Shabbir',
    phone: '0345-4433221',
    purpose: 'Product Purchase',
    personToMeet: 'Kamran Ashraf (Manager)',
    entryDate: '2026-11-06',
    entryTime: '02:00 PM',
    exitTime: '',
    status: 'Inside',
    remarks: 'Browsing Washing Machines and Microwave Ovens',
    createdBy: 'Faizan Sheikh'
  }
];

export const initialProducts: Product[] = [
  {
    id: 'PROD-01',
    name: 'Haier 1.5 Ton T3 DC Inverter AC',
    category: 'Air Conditioners',
    subCategory: 'DC Inverter',
    brand: 'Haier',
    modelNumber: 'HSU-18HFT/013-USDC',
    sku: 'HAE-AC-18HFT',
    barcode: '8964001122334',
    unit: 'Unit',
    purchasePrice: 138000,
    retailPrice: 165000,
    minSalePrice: 155000,
    stockQuantity: 12,
    minStockLevel: 4,
    warrantyMonths: 120, // 10 years compressor
    hasSerialTracking: true,
    description: 'T3 Tropical Inverter, 66% Energy Saving, WiFi control, UPS enabled',
    serials: [
      {
        serialNumber: 'HR-AC-2026-001',
        productId: 'PROD-01',
        productName: 'Haier 1.5 Ton T3 DC Inverter AC',
        condition: 'Brand New',
        purchaseCost: 138000,
        supplierId: 'SUP-202',
        supplierName: 'Haier Appliances Official Dist.',
        purchaseInvoiceNo: 'PINV-1001',
        purchaseDate: '2026-10-15',
        status: 'In Stock',
        warrantyMonths: 120
      },
      {
        serialNumber: 'HR-AC-2026-002',
        productId: 'PROD-01',
        productName: 'Haier 1.5 Ton T3 DC Inverter AC',
        condition: 'Brand New',
        purchaseCost: 138000,
        supplierId: 'SUP-202',
        supplierName: 'Haier Appliances Official Dist.',
        purchaseInvoiceNo: 'PINV-1001',
        purchaseDate: '2026-10-15',
        status: 'In Stock',
        warrantyMonths: 120
      },
      {
        serialNumber: 'HR-AC-2026-003',
        productId: 'PROD-01',
        productName: 'Haier 1.5 Ton T3 DC Inverter AC',
        condition: 'Brand New',
        purchaseCost: 138000,
        supplierId: 'SUP-202',
        supplierName: 'Haier Appliances Official Dist.',
        purchaseInvoiceNo: 'PINV-1001',
        purchaseDate: '2026-10-15',
        status: 'Reserved',
        warrantyMonths: 120
      }
    ]
  },
  {
    id: 'PROD-02',
    name: 'Dawlance Chrome 91996 Inverter Refrigerator',
    category: 'Refrigerators',
    subCategory: 'Glass Door Inverter',
    brand: 'Dawlance',
    modelNumber: '91996-CHROME-INV',
    sku: 'DAW-REF-91996',
    barcode: '8964002233445',
    unit: 'Unit',
    purchasePrice: 112000,
    retailPrice: 135000,
    minSalePrice: 125000,
    stockQuantity: 8,
    minStockLevel: 3,
    warrantyMonths: 144, // 12 years compressor
    hasSerialTracking: true,
    description: 'NatureLock Technology, A++ Energy rating, Tempered glass shelves',
    serials: [
      {
        serialNumber: 'DW-REF-99601',
        productId: 'PROD-02',
        productName: 'Dawlance Chrome 91996 Inverter Refrigerator',
        condition: 'Brand New',
        purchaseCost: 112000,
        supplierId: 'SUP-201',
        supplierName: 'Dawlance Electronics Pakistan',
        purchaseInvoiceNo: 'PINV-1002',
        purchaseDate: '2026-10-18',
        status: 'In Stock',
        warrantyMonths: 144
      },
      {
        serialNumber: 'DW-REF-99602',
        productId: 'PROD-02',
        productName: 'Dawlance Chrome 91996 Inverter Refrigerator',
        condition: 'Brand New',
        purchaseCost: 112000,
        supplierId: 'SUP-201',
        supplierName: 'Dawlance Electronics Pakistan',
        purchaseInvoiceNo: 'PINV-1002',
        purchaseDate: '2026-10-18',
        status: 'In Stock',
        warrantyMonths: 144
      }
    ]
  },
  {
    id: 'PROD-03',
    name: 'Samsung 65" Crystal UHD 4K Smart TV',
    category: 'LED TVs',
    subCategory: 'Smart 4K TV',
    brand: 'Samsung',
    modelNumber: 'CU7000-65',
    sku: 'SAM-LED-65CU',
    barcode: '8964003344556',
    unit: 'Unit',
    purchasePrice: 185000,
    retailPrice: 220000,
    minSalePrice: 205000,
    stockQuantity: 5,
    minStockLevel: 2,
    warrantyMonths: 24,
    hasSerialTracking: true,
    description: 'PurColor, Crystal Processor 4K, Smart Hub, HDR10+, OTS Lite',
    serials: [
      {
        serialNumber: 'SAM-TV-65-8841',
        productId: 'PROD-03',
        productName: 'Samsung 65" Crystal UHD 4K Smart TV',
        condition: 'Brand New',
        purchaseCost: 185000,
        supplierId: 'SUP-204',
        supplierName: 'Samsung Electronics Distributor',
        purchaseInvoiceNo: 'PINV-1003',
        purchaseDate: '2026-10-20',
        status: 'In Stock',
        warrantyMonths: 24
      }
    ]
  },
  {
    id: 'PROD-04',
    name: 'Gree 1.5 Ton Fairy Inverter AC (Heat & Cool)',
    category: 'Air Conditioners',
    subCategory: 'DC Inverter',
    brand: 'Gree',
    modelNumber: 'GS-18FITH1G',
    sku: 'GRE-AC-18FIT',
    barcode: '8964004455667',
    unit: 'Unit',
    purchasePrice: 145000,
    retailPrice: 172000,
    minSalePrice: 162000,
    stockQuantity: 14,
    minStockLevel: 5,
    warrantyMonths: 120,
    hasSerialTracking: true,
    description: 'G-10 Inverter, 3D Air Flow, Elegant Curved Champagne Gold finish'
  },
  {
    id: 'PROD-05',
    name: 'PEL Arctic Deep Freezer 350L (Double Door)',
    category: 'Deep Freezers',
    subCategory: 'Double Door',
    brand: 'PEL',
    modelNumber: 'PDF-350-JUMBO',
    sku: 'PEL-DF-350',
    barcode: '8964005566778',
    unit: 'Unit',
    purchasePrice: 78000,
    retailPrice: 94000,
    minSalePrice: 87000,
    stockQuantity: 3, // LOW STOCK ALERT
    minStockLevel: 5,
    warrantyMonths: 120,
    hasSerialTracking: true,
    description: 'Rapid Freezing, Copper condenser, Low voltage startup 100V'
  },
  {
    id: 'PROD-06',
    name: 'Dawlance DWT-260 C Lvs Fully Automatic Washing Machine',
    category: 'Washing Machines',
    subCategory: 'Top Load Automatic',
    brand: 'Dawlance',
    modelNumber: 'DWT-260-C-LVS',
    sku: 'DAW-WM-260',
    barcode: '8964006677889',
    unit: 'Unit',
    purchasePrice: 68000,
    retailPrice: 82000,
    minSalePrice: 76000,
    stockQuantity: 2, // LOW STOCK ALERT
    minStockLevel: 4,
    warrantyMonths: 120,
    hasSerialTracking: true,
    description: 'Pro Fabric Drum, Low voltage operation, Glass hydraulic lid'
  },
  {
    id: 'PROD-07',
    name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium (PTA Approved)',
    category: 'Mobiles',
    subCategory: 'Flagship Smartphone',
    brand: 'Apple',
    modelNumber: 'A3106-256-NAT',
    sku: 'APL-IP15PM-256',
    barcode: '195949038221',
    unit: 'Unit',
    purchasePrice: 420000,
    retailPrice: 485000,
    minSalePrice: 465000,
    stockQuantity: 2, // LOW STOCK
    minStockLevel: 3,
    warrantyMonths: 12,
    hasSerialTracking: true,
    description: 'A17 Pro chip, Titanium design, 5x Telephoto camera, PTA Approved Official',
    serials: [
      {
        serialNumber: 'IMEI-352994018472910',
        productId: 'PROD-07',
        productName: 'Apple iPhone 15 Pro Max 256GB Natural Titanium',
        condition: 'Brand New',
        purchaseCost: 420000,
        supplierId: 'SUP-204',
        supplierName: 'Samsung Electronics Distributor',
        purchaseInvoiceNo: 'PINV-1004',
        purchaseDate: '2026-10-25',
        status: 'In Stock',
        warrantyMonths: 12
      }
    ]
  },
  {
    id: 'PROD-08',
    name: 'Kenwood Homage Inverter UPS 2.2kVA',
    category: 'Home Appliances',
    subCategory: 'Inverter & UPS',
    brand: 'Kenwood',
    modelNumber: 'K-2200-HEX',
    sku: 'KEN-UPS-2200',
    barcode: '8964007788990',
    unit: 'Unit',
    purchasePrice: 52000,
    retailPrice: 64000,
    minSalePrice: 59000,
    stockQuantity: 7,
    minStockLevel: 3,
    warrantyMonths: 24,
    hasSerialTracking: true,
    description: 'Pure Sine Wave, Solar compatible, LCD Display, Multi-stage charging'
  }
];

export const initialPurchases: PurchaseInvoice[] = [
  {
    id: 'PINV-1001',
    invoiceNumber: 'PINV-1001',
    supplierId: 'SUP-202',
    supplierName: 'Haier Appliances Official Dist.',
    date: '2026-10-15',
    items: [
      {
        productId: 'PROD-01',
        productName: 'Haier 1.5 Ton T3 DC Inverter AC',
        brand: 'Haier',
        modelNumber: 'HSU-18HFT/013-USDC',
        quantity: 10,
        purchasePrice: 138000,
        total: 1380000,
        serialNumbers: ['HR-AC-2026-001', 'HR-AC-2026-002', 'HR-AC-2026-003']
      }
    ],
    subTotal: 1380000,
    discount: 30000,
    tax: 0,
    freightCharges: 10000,
    grandTotal: 1360000,
    paidAmount: 600000,
    remainingBalance: 760000,
    paymentMethod: 'Bank Transfer',
    status: 'Received',
    notes: 'Seasonal bulk supply consignment # 4401',
    createdBy: 'Muhammad Tariq Khan'
  },
  {
    id: 'PINV-1002',
    invoiceNumber: 'PINV-1002',
    supplierId: 'SUP-201',
    supplierName: 'Dawlance Electronics Pakistan',
    date: '2026-10-18',
    items: [
      {
        productId: 'PROD-02',
        productName: 'Dawlance Chrome 91996 Inverter Refrigerator',
        brand: 'Dawlance',
        modelNumber: '91996-CHROME-INV',
        quantity: 8,
        purchasePrice: 112000,
        total: 896000,
        serialNumbers: ['DW-REF-99601', 'DW-REF-99602']
      }
    ],
    subTotal: 896000,
    discount: 20000,
    tax: 0,
    freightCharges: 8000,
    grandTotal: 884000,
    paidAmount: 400000,
    remainingBalance: 484000,
    paymentMethod: 'Bank Transfer',
    status: 'Received',
    notes: 'Glass series refrigerators delivery',
    createdBy: 'Muhammad Tariq Khan'
  }
];

export const initialSales: SalesInvoice[] = [
  {
    id: 'INV-5001',
    invoiceNumber: 'INV-5001',
    customerId: 'CUST-103',
    customerName: 'Dr. Ayesha Siddiqa',
    customerPhone: '0333-5566778',
    saleType: 'Cash',
    date: '2026-11-04',
    items: [
      {
        productId: 'PROD-01',
        productName: 'Haier 1.5 Ton T3 DC Inverter AC',
        brand: 'Haier',
        modelNumber: 'HSU-18HFT/013-USDC',
        quantity: 1,
        unitPrice: 165000,
        costPrice: 138000,
        discount: 5000,
        total: 160000,
        selectedSerial: 'HR-AC-2026-004'
      }
    ],
    subTotal: 165000,
    discount: 5000,
    tax: 0,
    grandTotal: 160000,
    paidAmount: 160000,
    changeAmount: 0,
    remainingBalance: 0,
    paymentMethod: 'Cash',
    status: 'Completed',
    salesPerson: 'Kamran Ashraf',
    notes: 'Full cash payment received at checkout'
  },
  {
    id: 'INV-5002',
    invoiceNumber: 'INV-5002',
    customerId: 'CUST-101',
    customerName: 'Sheikh Abdul Rehman',
    customerPhone: '0300-4829102',
    saleType: 'Installment',
    date: '2026-10-10',
    items: [
      {
        productId: 'PROD-02',
        productName: 'Dawlance Chrome 91996 Inverter Refrigerator',
        brand: 'Dawlance',
        modelNumber: '91996-CHROME-INV',
        quantity: 1,
        unitPrice: 135000,
        costPrice: 112000,
        discount: 0,
        total: 135000,
        selectedSerial: 'DW-REF-99603'
      }
    ],
    subTotal: 135000,
    discount: 0,
    tax: 0,
    grandTotal: 135000,
    paidAmount: 35000, // Down payment
    changeAmount: 0,
    remainingBalance: 100000,
    paymentMethod: 'Cash',
    status: 'Completed',
    salesPerson: 'Kamran Ashraf',
    notes: 'Sold on 10 months installment plan',
    installmentAccountId: 'INST-2026-001'
  }
];

export const initialInstallments: InstallmentAccount[] = [
  {
    id: 'INST-2026-001',
    accountNumber: 'INST-2026-001',
    customerId: 'CUST-101',
    customerName: 'Sheikh Abdul Rehman',
    customerPhone: '0300-4829102',
    customerCnic: '35202-1849201-3',
    customerAddress: 'House # 45, Street 8, Model Town, Lahore',
    productId: 'PROD-02',
    productName: 'Dawlance Chrome 91996 Inverter Refrigerator',
    productModel: '91996-CHROME-INV',
    productSerial: 'DW-REF-99603',
    salesInvoiceNo: 'INV-5002',
    cashPrice: 135000,
    downPayment: 35000,
    financedAmount: 100000,
    markupPercentage: 20, // 20% flat markup
    markupAmount: 20000,
    totalFinancedPayable: 120000,
    totalPayableWithDown: 155000,
    durationMonths: 12,
    monthlyInstallment: 10000,
    startDate: '2026-10-10',
    firstDueDate: '2026-11-10',
    guarantor1Name: 'Hafiz Farooq Ahmad',
    guarantor1Phone: '0321-4455888',
    guarantor1Cnic: '35202-7788991-3',
    guarantor1Relation: 'Brother-in-law',
    recoveryOfficerId: 'EMP-04',
    recoveryOfficerName: 'Shahid Mehmood',
    totalReceived: 45000, // 35000 down + 10000 Nov installment
    remainingBalance: 110000,
    status: 'Active',
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-11-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 10000,
        remainingAmount: 0,
        paidDate: '2026-11-05',
        status: 'Paid',
        receiptNo: 'RCT-701'
      },
      {
        installmentNumber: 2,
        dueDate: '2026-12-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 3,
        dueDate: '2027-01-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 4,
        dueDate: '2027-02-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 5,
        dueDate: '2027-03-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 6,
        dueDate: '2027-04-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 7,
        dueDate: '2027-05-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 8,
        dueDate: '2027-06-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 9,
        dueDate: '2027-07-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 10,
        dueDate: '2027-08-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 11,
        dueDate: '2027-09-10',
        principalAmount: 8333,
        markupAmount: 1667,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      },
      {
        installmentNumber: 12,
        dueDate: '2027-10-10',
        principalAmount: 8337,
        markupAmount: 1663,
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming'
      }
    ]
  },
  {
    id: 'INST-2026-002',
    accountNumber: 'INST-2026-002',
    customerId: 'CUST-102',
    customerName: 'Chaudhry Nadeem Akhtar',
    customerPhone: '0321-7654321',
    customerCnic: '35201-9876543-1',
    customerAddress: 'Plaza 12, Gulberg III, Lahore',
    productId: 'PROD-03',
    productName: 'Samsung 65" Crystal UHD 4K Smart TV',
    productModel: 'CU7000-65',
    productSerial: 'SAM-TV-65-8840',
    salesInvoiceNo: 'INV-4990',
    cashPrice: 220000,
    downPayment: 60000,
    financedAmount: 160000,
    markupPercentage: 20,
    markupAmount: 32000,
    totalFinancedPayable: 192000,
    totalPayableWithDown: 252000,
    durationMonths: 12,
    monthlyInstallment: 16000,
    startDate: '2026-09-02',
    firstDueDate: '2026-10-02',
    guarantor1Name: 'Ijaz Ahmad Chaudhry',
    guarantor1Phone: '0300-8899112',
    guarantor1Cnic: '35201-8899001-5',
    guarantor1Relation: 'Cousin',
    recoveryOfficerId: 'EMP-04',
    recoveryOfficerName: 'Shahid Mehmood',
    totalReceived: 76000, // 60000 down + 16000 Oct installment
    remainingBalance: 176000,
    status: 'Overdue', // November installment was due on Nov 2nd!
    schedule: [
      {
        installmentNumber: 1,
        dueDate: '2026-10-02',
        principalAmount: 13333,
        markupAmount: 2667,
        totalDue: 16000,
        paidAmount: 16000,
        remainingAmount: 0,
        paidDate: '2026-10-02',
        status: 'Paid',
        receiptNo: 'RCT-640'
      },
      {
        installmentNumber: 2,
        dueDate: '2026-11-02',
        principalAmount: 13333,
        markupAmount: 2667,
        totalDue: 16000,
        paidAmount: 0,
        remainingAmount: 16000,
        status: 'Overdue' // Overdue alert!
      },
      {
        installmentNumber: 3,
        dueDate: '2026-12-02',
        principalAmount: 13333,
        markupAmount: 2667,
        totalDue: 16000,
        paidAmount: 0,
        remainingAmount: 16000,
        status: 'Upcoming'
      }
    ]
  }
];

export const initialChartOfAccounts: AccountHead[] = [
  // Assets
  { id: 'ACC-101', code: '1001', name: 'Cash in Hand (Showroom Drawer)', category: 'Asset', subCategory: 'Cash & Bank', currentBalance: 345000 },
  { id: 'ACC-102', code: '1002', name: 'Meezan Bank - Current A/C # 0201010049281', category: 'Asset', subCategory: 'Cash & Bank', currentBalance: 2450000 },
  { id: 'ACC-103', code: '1003', name: 'Bank Alfalah - Current A/C # 55109849201', category: 'Asset', subCategory: 'Cash & Bank', currentBalance: 1820000 },
  { id: 'ACC-104', code: '1010', name: 'Accounts Receivable (Customers)', category: 'Asset', subCategory: 'Receivables', currentBalance: 260000 },
  { id: 'ACC-105', code: '1020', name: 'Installment Receivables Portfolio', category: 'Asset', subCategory: 'Receivables', currentBalance: 286000 },
  { id: 'ACC-106', code: '1030', name: 'Finished Electronics Merchandise Inventory', category: 'Asset', subCategory: 'Inventory', currentBalance: 4890000 },
  { id: 'ACC-107', code: '1040', name: 'Showroom Fixtures, ACs & Display Racks', category: 'Asset', subCategory: 'Fixed Assets', currentBalance: 1200000 },
  // Liabilities
  { id: 'ACC-201', code: '2001', name: 'Accounts Payable (Distributors & Suppliers)', category: 'Liability', subCategory: 'Payables', currentBalance: 4100000 },
  { id: 'ACC-202', code: '2002', name: 'Sales Tax Payable', category: 'Liability', subCategory: 'Statutory', currentBalance: 0 },
  // Equity
  { id: 'ACC-301', code: '3001', name: 'Owner Capital - Muhammad Tariq Khan', category: 'Equity', subCategory: 'Capital', currentBalance: 6500000 },
  { id: 'ACC-302', code: '3002', name: 'Retained Earnings', category: 'Equity', subCategory: 'Reserves', currentBalance: 641000 },
  // Income
  { id: 'ACC-401', code: '4001', name: 'Sales Revenue - Electronics Cash & Credit', category: 'Income', subCategory: 'Operating Revenue', currentBalance: 295000 },
  { id: 'ACC-402', code: '4002', name: 'Installment Markup Income', category: 'Income', subCategory: 'Financing Income', currentBalance: 52000 },
  // Expenses
  { id: 'ACC-501', code: '5001', name: 'Cost of Goods Sold (COGS)', category: 'Expense', subCategory: 'Direct Cost', currentBalance: 250000 },
  { id: 'ACC-502', code: '5002', name: 'Showroom Rent & Maintenance', category: 'Expense', subCategory: 'Operating Expense', currentBalance: 80000 },
  { id: 'ACC-503', code: '5003', name: 'Electricity & Genset Diesel Charges', category: 'Expense', subCategory: 'Operating Expense', currentBalance: 45000 },
  { id: 'ACC-504', code: '5004', name: 'Staff Salaries & Commissions', category: 'Expense', subCategory: 'Payroll Expense', currentBalance: 120000 },
  { id: 'ACC-505', code: '5005', name: 'Delivery, Carriage & Transport Freight', category: 'Expense', subCategory: 'Logistics', currentBalance: 18000 }
];

export const initialVouchers: Voucher[] = [
  {
    id: 'VOUCH-801',
    voucherNumber: 'PV-801',
    voucherType: 'Payment Voucher',
    date: '2026-11-03',
    partyType: 'Supplier',
    partyId: 'SUP-201',
    partyName: 'Dawlance Electronics Pakistan',
    amount: 250000,
    paymentMethod: 'Bank',
    narration: 'Paid via Meezan Bank Online Transfer against invoice PINV-1002 part payment',
    createdBy: 'Asim Raza',
    status: 'Posted',
    entries: [
      { accountId: 'ACC-201', accountName: 'Accounts Payable (Distributors & Suppliers)', debit: 250000, credit: 0 },
      { accountId: 'ACC-102', accountName: 'Meezan Bank - Current A/C # 0201010049281', debit: 0, credit: 250000 }
    ]
  },
  {
    id: 'VOUCH-802',
    voucherNumber: 'PV-802',
    voucherType: 'Payment Voucher',
    date: '2026-11-04',
    partyType: 'Expense',
    partyName: 'Showroom Electricity Bill - LESCO',
    amount: 45000,
    paymentMethod: 'Cash',
    narration: 'October commercial electricity bill payment paid in cash',
    createdBy: 'Bilal Hussain',
    status: 'Posted',
    entries: [
      { accountId: 'ACC-503', accountName: 'Electricity & Genset Diesel Charges', debit: 45000, credit: 0 },
      { accountId: 'ACC-101', accountName: 'Cash in Hand (Showroom Drawer)', debit: 0, credit: 45000 }
    ]
  },
  {
    id: 'VOUCH-803',
    voucherNumber: 'RV-803',
    voucherType: 'Receive Voucher',
    date: '2026-11-05',
    partyType: 'Customer',
    partyId: 'CUST-101',
    partyName: 'Sheikh Abdul Rehman',
    amount: 10000,
    paymentMethod: 'Cash',
    narration: 'Monthly installment received for Nov-2026 Dawlance Inverter Refrigerator',
    createdBy: 'Bilal Hussain',
    status: 'Posted',
    entries: [
      { accountId: 'ACC-101', accountName: 'Cash in Hand (Showroom Drawer)', debit: 10000, credit: 0 },
      { accountId: 'ACC-105', accountName: 'Installment Receivables Portfolio', debit: 0, credit: 10000 }
    ]
  },
  {
    id: 'VOUCH-804',
    voucherNumber: 'JV-804',
    voucherType: 'Journal Voucher',
    date: '2026-11-05',
    narration: 'Monthly depreciation adjustment for showroom AC fixtures & display racks',
    amount: 15000,
    createdBy: 'Asim Raza',
    status: 'Posted',
    entries: [
      { accountId: 'ACC-502', accountName: 'Showroom Rent & Maintenance', debit: 15000, credit: 0, narration: 'Fixtures maintenance' },
      { accountId: 'ACC-107', accountName: 'Showroom Fixtures, ACs & Display Racks', debit: 0, credit: 15000, narration: 'Depreciation provision' }
    ]
  }
];

export const initialCheques: ChequeRecord[] = [
  {
    id: 'CHQ-01',
    chequeNumber: '9482019',
    type: 'Received',
    bankName: 'Habib Bank Limited (HBL)',
    partyName: 'Sheikh Abdul Rehman',
    amount: 75000,
    issueDate: '2026-11-01',
    chequeDate: '2026-11-15',
    status: 'Pending',
    remarks: 'Security cheque for 12 months installment appliance plan'
  },
  {
    id: 'CHQ-02',
    chequeNumber: '1102948',
    type: 'Issued',
    bankName: 'Meezan Bank Ltd',
    partyName: 'Haier Appliances Official Dist.',
    amount: 400000,
    issueDate: '2026-10-28',
    chequeDate: '2026-11-08',
    status: 'Pending',
    remarks: 'Post dated payment against invoice PINV-1001'
  }
];

export const initialTargets: Target[] = [
  {
    id: 'TGT-01',
    targetType: 'Sales',
    period: 'Monthly',
    monthYear: '2026-11',
    targetAmount: 5000000, // 50 Lakhs PKR
    achievedAmount: 1850000,
    assignedTo: 'Showroom Overall',
    status: 'In Progress'
  },
  {
    id: 'TGT-02',
    targetType: 'Recovery',
    period: 'Monthly',
    monthYear: '2026-11',
    targetAmount: 800000, // 8 Lakhs recovery
    achievedAmount: 320000,
    assignedTo: 'Shahid Mehmood',
    status: 'In Progress'
  }
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'AUD-901',
    timestamp: '2026-11-06 08:30:12',
    userId: 'usr-1',
    userName: 'Muhammad Tariq Khan',
    userRole: 'Owner',
    module: 'Authentication',
    action: 'System Login',
    details: 'User authenticated from IP 192.168.1.100 (Owner Terminal)'
  },
  {
    id: 'AUD-902',
    timestamp: '2026-11-06 08:45:22',
    userId: 'usr-7',
    userName: 'Faizan Sheikh',
    userRole: 'Receptionist',
    module: 'Visitors',
    action: 'Visitor Entry',
    details: 'Logged arrival of Muhammad Rizwan for Haier AC inquiry'
  },
  {
    id: 'AUD-903',
    timestamp: '2026-11-06 09:12:00',
    userId: 'usr-3',
    userName: 'Bilal Hussain',
    userRole: 'Cashier',
    module: 'Attendance',
    action: 'Staff Check-In',
    details: 'Marked attendance at 09:12 AM (Status: Late)'
  },
  {
    id: 'AUD-904',
    timestamp: '2026-11-06 10:20:45',
    userId: 'usr-3',
    userName: 'Bilal Hussain',
    userRole: 'Cashier',
    module: 'Installment & Recovery',
    action: 'Receive Payment',
    details: 'Posted installment payment of PKR 10,000 for Account # INST-2026-001 (Receipt RCT-701)'
  }
];
