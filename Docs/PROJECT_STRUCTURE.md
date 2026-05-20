 - Elite SaaS BackendBẩệpvớiiếúFfyPlgnd,ậpugàAI-Nave,**Mlcy,vàEltSrty.với FsyPlugiRoutes → ssies↓↓          Auth/Rate             Limit                   Logic       Logic
app.ts                 # Fastify app initialization
│   ├── server.ts              # Server entry point
│   │
│   ├── fig/                # Configuraion files
│   │   ├── database.ts        # MongoDB connection
│   │   ├── edis.ts           # Redis cnnection
│   │   ├── sentry.ts          # Sentry monitoring
│   │   └── env.ts             # Environment vaidation
│   │
│   ├── control     handlr
│   │   ├──aut.cotrol.tprodc├order.contrller.t
│   │   └── ai    er
│   │   ├── auth.svice.tsprodct.service.s
│   │   ├── order├ ai.service.ts      # AI/RAGlgic
│   │   ├── media.service.t   # Image optimizaion
│   │   └── email    er.rpository.ts
│   │   ├── poduct├order.reositry.t
│   │   └── tenan.ts
│   │
│   ├── models/                # Mongoose schemas
│   │   ├── User.ts
│   │   ├── Product.ts
│   │   ├── Order.ts
│   │   ├── Tenant.ts
│   │   └── KnowledgeBase    Fatifytenn     APIr.ts
│   │   ├── auth.routesprodc├order.rute.s
│   │   └── aipugin   Fsify plugin
│   │   ├──crs.pugin.t
│   │   ├── let.plugin.tcomprespuginmultiarpugin    s
│   │   ├──auth.typs.prodc    ├tors.s
│   │   └── errjbs      Backud jobs(QStah)emil.joindx.job   #AIindexingobclaup.jobscriptsUtiliy cipste-produc-mages.tmigrate-ordr-itms.teed-ordrs├aa/       Stat dat
│   │   └── axmes.jso│   │   └                uplods/                   # Teorary upoad foldr
├──scratch/         Deelpscch fisev.xample└vtst/, headersAAI/RAG opnImgopimizEmlendgcioochetration HTPledgeMongoDBMuli-tenncyflteriodels (`src/models/`)
- Mongoose schema defnitions
- Virtual fiels
- Instance methos
- Static methods
- Indexes

### 5. Midd (JWT)
- Ml-enancy ctextaemigquestogg6
-Zod validainschemas

### 7. Plugins (`sc/plgins/`)
- Fasify plugin rgitrationCORS, Helmet, Cmss
- Mutiprfil ulad:POST/ap/v1/productsprodct
Hade: { Authorization: "Bearer <token>", X-Tenant-ID: "tenant123" }Body: { name: "Product A", price: 100 }
1authvrify JWTeantse tnantcntextre-litralmit2poduct(Zodvlidaion)3poductPoduct4poductPoductProcess imge (Sarp + WbP)
 - Ulod t R25prodct
  - Add tenantId filterMongoDBdocum6 JSONMult-tenacyFirMọiquy đều có`tentId`fitA-Nave Tích hợpGmiVin &EmbddgPug ArchitectureFaifypugincmularitySecury Frst JWT, 2FA,RaeLimg,HmtPrformaneRdsccgImgoptzaoObsrvSnty,PoHog,Po oggingTestVitc nit/inegtots.ts`
- Models: PascalCase (e.g., `User) FastifyRequest,FastifyReplyfastifyPoduct..prodct.js...jsPoduct..prodcts.jMlsPrducmodePduct.j``

**Note**: Tất cả imports phải có .js extension (ESM requirement)
```bash#
pm
# environment variables
cp

#Strt evelpmet sevrnpmrdev

#Rtests
pmst
#Buil forproucion
pmuil
#prouctionpmsar
`