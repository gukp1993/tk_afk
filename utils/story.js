// 演义剧情关卡表：12 章 × 10 关（对照《三国演义》名场面改编，全部原创文案）
// 数据约束（smoke 有断言锁定）：
//   - 每章恰 10 关，第 10 关为名将关（foes[0] 为主将），须带 dialogue 对白
//   - 所有 foes / dialogue.who 的 id 必须能在 heroes.HEROES 解析
//   - 超出本表的关卡由 stages.js 的循环乱世兜底（兜底表也从本表派生，单一数据源）
// 数值（强度曲线/等级/星级）不在此表——由 stages.makeStageEnemies 统一生成。

const CHAPTERS = [
  {
    id: 'ch01', name: '黄巾之乱', subtitle: '桃园结义',
    intro: '涿郡桃园，刘关张三兄弟焚香结义，聚乡勇五百，兵发黄巾。',
    finale: '张角授首，黄巾既平。然乱世方启，董卓入京，大乱将至。',
    stages: [
      { name: '桃园结义', narration: '桃园一拜，生死相托。三兄弟打造双股剑、青龙偃月刀、丈八蛇矛，直扑黄巾前哨。',
        foes: ['jiling', 'yuanshu', 'gongsunzan', 'yuji', 'yangxiu'] },
      { name: '大兴山遭遇', narration: '大兴山下贼军结阵，刀矛如林，黄巾遮天。',
        foes: ['huaxiong', 'jiling', 'gongsunzan', 'yuji', 'yuanshu'] },
      { name: '青州解围', narration: '青州告急，贼众围城。玄德设伏于城外山道，内外夹击。',
        foes: ['yuji', 'zuoci', 'jiling', 'yuanshu', 'huatuo'] },
      { name: '颍川截击', narration: '颍川贼众十万被火攻破营，我部截击溃兵。',
        foes: ['zuoci', 'yuji', 'huatuo', 'jiling', 'gongsunzan'] },
      { name: '曲阳对峙', narration: '曲阳贼垒连营，妖道登坛作法，风云变色。',
        foes: ['zuoci', 'yuji', 'huatuo', 'yangxiu', 'yuanshu'] },
      { name: '广宗外围', narration: '广宗城下，黄巾力士负土筑垒，箭如飞蝗。',
        foes: ['jiling', 'huaxiong', 'yuanshu', 'yuji', 'zuoci'] },
      { name: '夜袭贼营', narration: '夜色如墨，火起为号，直捣中军大帐。',
        foes: ['yuji', 'zuoci', 'jiling', 'gongsunzan', 'huatuo'] },
      { name: '长社追击', narration: '长社火起，贼众溃走百里，乘胜穷追。',
        foes: ['jiling', 'yuanshu', 'yangxiu', 'yuji', 'zuoci'] },
      { name: '广宗城下', narration: '广宗孤城，张角登坛祭天，欲以妖术退敌。',
        foes: ['huatuo', 'zuoci', 'yuji', 'huaxiong', 'jiling'] },
      { name: '张角·大贤良师', narration: '「苍天已死，黄天当立！」张角仗剑而出，符水化作漫天火雨。',
        dialogue: [
          { who: 'zhangjiao', text: '苍天已死，黄天当立！岁在甲子，天下大吉！' },
          { who: 'liubei', text: '妖言惑众，苍生涂炭。今日我兄弟三人，替天行道！' },
        ],
        foes: ['zhangjiao', 'yuji', 'zuoci', 'huatuo', 'jiling'] }
    ]
  },
  {
    id: 'ch02', name: '虎牢关', subtitle: '温酒斩华雄 · 三英战吕布',
    intro: '曹操发矫诏，十八路诸侯会盟讨董。兵锋直指汜水、虎牢二关。',
    finale: '吕布败走，董卓弃关西逃。温酒尚热，然诸侯各怀异心，盟约自此瓦解。',
    stages: [
      { name: '会盟兴兵', narration: '十八路诸侯歃血为盟，袁绍执牛耳，旌旗蔽日，直逼汜水关。',
        foes: ['gaoshun', 'liru', 'chengong', 'huaxiong', 'dongzhuo'] },
      { name: '汜水关前', narration: '守将华雄骁勇，连斩联军数将，帐内诸侯尽皆失色。',
        foes: ['huaxiong', 'gaoshun', 'liru', 'chengong', 'dongzhuo'] },
      { name: '温酒斩华雄', narration: '「酒且斟下，某去便来。」其酒尚温，华雄首级已掷于帐前。',
        foes: ['huaxiong', 'liru', 'gaoshun', 'chengong', 'dongzhuo'] },
      { name: '吕布出关', narration: '吕布亲率铁骑出关，方天画戟所向披靡，河内名将方悦，不上五合被刺于马下。',
        foes: ['lvbu', 'gaoshun', 'liru', 'chengong', 'huaxiong'] },
      { name: '虎牢关下', narration: '虎牢关前，西凉铁骑漫山遍野，杀气冲天。',
        foes: ['gaoshun', 'chengong', 'liru', 'lvbu', 'dongzhuo'] },
      { name: '画戟无双', narration: '联军先锋接连败退，吕布横戟立马，天下无人敢当。',
        foes: ['lvbu', 'huaxiong', 'gaoshun', 'liru', 'chengong'] },
      { name: '夜劫曹营', narration: '曹操引兵夜袭，中了李儒设下的伏兵之计，狼狈而走。',
        foes: ['liru', 'gaoshun', 'chengong', 'lvbu', 'huaxiong'] },
      { name: '迁都之乱', narration: '董卓焚洛阳、迁都长安，掠民百万，哭声震野，联军衔尾追击。',
        foes: ['dongzhuo', 'liru', 'gaoshun', 'chengong', 'lvbu'] },
      { name: '荥阳伏兵', narration: '荥阳道险，伏兵尽起，曹军折损大半。诸侯合围虎牢。',
        foes: ['chengong', 'gaoshun', 'liru', 'lvbu', 'dongzhuo'] },
      { name: '三英战吕布', narration: '公孙瓒败走，张飞大叫：「三姓家奴休走！」关云长舞刀来援，三匹马丁字般厮杀。',
        dialogue: [
          { who: 'lvbu', text: '吾乃飞将吕布！十八路诸侯，不过插标卖首之徒！' },
          { who: 'zhangfei', text: '三姓家奴休走！燕人张飞在此！' },
          { who: 'guanyu', text: '云长既至，兄弟同心，共战温侯！' },
        ],
        foes: ['lvbu', 'gaoshun', 'chengong', 'liru', 'huaxiong'] }
    ]
  },
  {
    id: 'ch03', name: '群雄逐鹿', subtitle: '袁术称帝 · 白门楼',
    intro: '盟约已散，群雄并起。吕布袭兖州、夺徐州，袁术在寿春僭号称帝。',
    finale: '白门楼落成，飞将殒命；袁术呕血而亡。北方，只剩袁曹双雄对峙。',
    stages: [
      { name: '兖州之变', narration: '曹操东征陶谦，吕布趁虚袭兖州，后方危在旦夕。',
        foes: ['lvbu', 'chengong', 'gaoshun', 'jiling', 'yuanshu'] },
      { name: '濮阳烈焰', narration: '濮阳城中火起，吕布戟指喝问：「曹操何在！」烈焰之中，险象环生。',
        foes: ['chengong', 'gaoshun', 'lvbu', 'jiling', 'yuanshu'] },
      { name: '辕门射戟', narration: '袁术遣纪灵攻刘备。吕布设宴辕门：「吾若一箭射中小枝，两家罢兵。」',
        foes: ['jiling', 'yuanshu', 'lvbu', 'gaoshun', 'chengong'] },
      { name: '徐州易主', narration: '吕布趁张飞醉酒，夜袭下邳，徐州易主。',
        foes: ['lvbu', 'gaoshun', 'chengong', 'jiling', 'yuanshu'] },
      { name: '小沛之争', narration: '刘吕反目，小沛城下战云密布。',
        foes: ['gaoshun', 'jiling', 'lvbu', 'chengong', 'yuanshu'] },
      { name: '仲家皇帝', narration: '袁术于寿春僭号称帝，骄奢淫逸，为天下共讨。',
        foes: ['yuanshu', 'jiling', 'lvbu', 'chengong', 'gaoshun'] },
      { name: '寿春攻防', narration: '寿春城坚粮足，袁术恃淮河天险，负隅顽抗。',
        foes: ['jiling', 'yuanshu', 'gaoshun', 'chengong', 'lvbu'] },
      { name: '下邳围城', narration: '曹操决沂泗之水灌下邳，吕布困守孤城，众叛亲离。',
        foes: ['lvbu', 'chengong', 'gaoshun', 'diaochan', 'jiling'] },
      { name: '白门楼前', narration: '城破在即，陈宫仰天长叹：「今日之事，唯死而已。」',
        foes: ['chengong', 'gaoshun', 'jiling', 'lvbu', 'diaochan'] },
      { name: '吕布·白门楼', narration: '白门楼上，吕布被缚，乞求缓绳。曹操问刘备何如，玄德淡淡一句，定了温侯的结局。',
        dialogue: [
          { who: 'lvbu', text: '明公所患，不过于布。布今已服矣，何忧之有？' },
          { who: 'liubei', text: '公不见丁建阳、董卓之事乎？' },
        ],
        foes: ['lvbu', 'chengong', 'gaoshun', 'diaochan', 'jiling'] }
    ]
  },
  {
    id: 'ch04', name: '官渡之战', subtitle: '斩颜良诛文丑 · 火烧乌巢',
    intro: '衣带诏事发，袁绍点精兵七十万南征，官渡对峙，河北与中原的命运在此一搏。',
    finale: '乌巢火起，七十万大军灰飞烟灭。袁绍呕血而亡，曹操一统北方，兵锋南指。',
    stages: [
      { name: '衣带诏', narration: '衣带诏事发，曹操血洗许都。袁绍誓师南征，大军压境。',
        foes: ['yanliang', 'wenchou', 'yuanshao', 'xuyou', 'zhanghe'] },
      { name: '白马之围', narration: '颜良兵围白马，连斩曹营数将，徐晃亦败走。',
        foes: ['yanliang', 'wenchou', 'zhanghe', 'yuanshao', 'xuyou'] },
      { name: '关公斩颜良', narration: '关羽匹马冲入万军之中，颜良措手不及，被一刀斩于马下。',
        foes: ['yanliang', 'wenchou', 'yuanshao', 'xuyou', 'zhanghe'] },
      { name: '诛文丑', narration: '文丑追击曹军，与关公战不三合，心怯欲走，被一刀挥为两段。',
        foes: ['wenchou', 'zhanghe', 'yuanshao', 'xuyou', 'jiling'] },
      { name: '官渡对峙', narration: '两军相持官渡，曹军粮尽，人心惶惶。',
        foes: ['yuanshao', 'zhanghe', 'xuyou', 'jiling', 'wenchou'] },
      { name: '许攸来投', narration: '袁绍谋士许攸夜奔曹营，献上乌巢屯粮的机密。',
        foes: ['zhanghe', 'yuanshao', 'jiling', 'wenchou', 'gongsunzan'] },
      { name: '火烧乌巢', narration: '曹操亲率轻骑夜袭乌巢，火光四起，七十万大军粮草尽成灰烬。',
        foes: ['yuanshao', 'zhanghe', 'xuyou', 'jiling', 'wenchou'] },
      { name: '仓亭之战', narration: '官渡惨败，袁绍仓亭再败，河北震动。',
        foes: ['yuanshao', 'zhanghe', 'jiling', 'wenchou', 'xuyou'] },
      { name: '决战前夜', narration: '袁绍纠合残部，倾尽河北之众，与曹军决一死战。',
        foes: ['yuanshao', 'zhanghe', 'xuyou', 'wenchou', 'jiling'] },
      { name: '袁绍·河北盟主', narration: '本初亲临阵前，四世三公的家底，尽押在这一战。',
        dialogue: [
          { who: 'yuanshao', text: '吾南据河，北阻燕代，兼沙漠之众，南向以争天下，谁能当之？' },
          { who: 'guanyu', text: '河北匹夫，不过如此。某观袁绍，色厉胆薄，好谋无断！' },
        ],
        foes: ['yuanshao', 'zhanghe', 'wenchou', 'xuyou', 'jiling'] }
    ]
  },
  {
    id: 'ch05', name: '三顾茅庐', subtitle: '博望坡 · 火烧新野',
    intro: '跃马檀溪，三顾茅庐。卧龙出山，第一把火烧在博望坡。',
    finale: '新野一把火，烧出卧龙之名。曹操亲提大军五十万杀奔荆州——长坂坡之劫已在眼前。',
    stages: [
      { name: '马跃檀溪', narration: '蔡瑁设宴欲害刘备，的卢马一跃三丈，飞过檀溪。',
        foes: ['caimao', 'liubiao', 'chendeng', 'wanglang', 'huaxin'] },
      { name: '水镜荐贤', narration: '水镜先生笑言：「卧龙凤雏，得一可安天下。」',
        foes: ['caimao', 'chendeng', 'liubiao', 'wanglang', 'huaxin'] },
      { name: '三顾茅庐', narration: '隆中草庐，诸葛亮纵论三分：「荆州乃用武之地，将军可取而守之。」',
        foes: ['caimao', 'liubiao', 'chendeng', 'huaxin', 'wanglang'] },
      { name: '博望坡前', narration: '夏侯惇引十万大军杀奔新野。军师初用兵，火攻已在弦上。',
        foes: ['xiahoudun', 'yujin', 'lidian', 'manchong', 'yuejin'] },
      { name: '火烧博望', narration: '「博望坡近新野，山路狭窄，草木繁盛——火攻可教他片甲不回。」',
        foes: ['xiahoudun', 'lidian', 'yujin', 'manchong', 'yuejin'] },
      { name: '败走博望', narration: '火光烧天，曹军自相践踏，夏侯惇大败而走。',
        foes: ['yujin', 'lidian', 'manchong', 'yuejin', 'xiahoudun'] },
      { name: '曹仁来袭', narration: '曹操怒起大军，遣曹仁、李典再取新野。',
        foes: ['caoren', 'lidian', 'yujin', 'manchong', 'yuejin'] },
      { name: '火烧新野', narration: '新野城中空无一人，屋上硫黄干草齐燃——曹军入城，即是火海。',
        foes: ['caoren', 'lidian', 'manchong', 'yuejin', 'yujin'] },
      { name: '白河用水', narration: '关羽上游决白河，水淹曹军。新野之火、白河之水，双计连环。',
        foes: ['caoren', 'yujin', 'lidian', 'manchong', 'yuejin'] },
      { name: '曹仁·八门金锁', narration: '曹仁摆下八门金锁阵，只待瓮中捉鳖。军师羽扇轻摇：破阵只欠一算。',
        dialogue: [
          { who: 'caoren', text: '八门金锁，休走一门！刘备小儿，今日插翅难逃！' },
          { who: 'zhugeliang', text: '八门虽妙，只欠一算。云长子龙，随我破阵！' },
        ],
        foes: ['caoren', 'lidian', 'yujin', 'manchong', 'yuejin'] }
    ]
  },
  {
    id: 'ch06', name: '长坂坡', subtitle: '单骑救主 · 喝断当阳桥',
    intro: '曹军五十万昼夜兼程，携民渡江的队伍被铁骑追上——当阳，血与火的一日。',
    finale: '长坂坡一战，赵云名震天下。孙刘两家终在柴桑坐到一起，赤壁大战一触即发。',
    stages: [
      { name: '携民渡江', narration: '十余万百姓随军渡江，日行十里；曹军铁骑，昼夜三百里。',
        foes: ['caohong', 'yuejin', 'lidian', 'guohuai', 'wenpin'] },
      { name: '当阳被困', narration: '当阳县外，曹军铁骑追至，军民大乱，喊声震天。',
        foes: ['wenpin', 'caohong', 'yuejin', 'guohuai', 'lidian'] },
      { name: '单骑救主', narration: '赵云单枪匹马反入重围：「主公家眷，皆在乱军之中！」',
        foes: ['xuhuang', 'zhanghe', 'caohong', 'yuejin', 'wenpin'] },
      { name: '七进七出', narration: '怀抱阿斗，枪刺剑砍，血满征袍。曹操于景山之上见之：「真虎将也！」',
        foes: ['xuhuang', 'zhanghe', 'caohong', 'wenpin', 'guohuai'] },
      { name: '夺剑斩旗', narration: '夺青釭剑，砍倒大旗两面，夺槊三条，长坂坡上白袍尽染。',
        foes: ['zhanghe', 'xuhuang', 'caohong', 'guohuai', 'wenpin'] },
      { name: '当阳桥', narration: '张飞立马桥上，三声大喝，声如巨雷，曹军闻风，无人敢近。',
        foes: ['xuchu', 'zhangliao', 'xuhuang', 'zhanghe', 'caohong'] },
      { name: '断桥拒敌', narration: '拆桥断路，曹军疑有伏兵，暂且退去。',
        foes: ['xuchu', 'zhangliao', 'xuhuang', 'zhanghe', 'guohuai'] },
      { name: '走江夏', narration: '突出重围，退往江夏，与刘琦合兵一处。',
        foes: ['caohong', 'yuejin', 'lidian', 'guohuai', 'wenpin'] },
      { name: '汉津接应', narration: '汉津渡口，曹军先锋再至，关羽引江夏之兵杀到接应。',
        foes: ['xuchu', 'zhangliao', 'caohong', 'yuejin', 'guohuai'] },
      { name: '许褚·虎卫中军', narration: '曹操亲率虎卫中军压至，许褚裸衣提刀，为大军开路。',
        dialogue: [
          { who: 'xuchu', text: '虎痴仲康在此！谁敢上前一步！' },
          { who: 'zhaoyun', text: '长坂坡上七进七出，今日再会虎痴！' },
        ],
        foes: ['xuchu', 'zhangliao', 'xuhuang', 'caohong', 'wenpin'] }
    ]
  },
  {
    id: 'ch07', name: '赤壁之战', subtitle: '借东风 · 火烧赤壁',
    intro: '八十三万大军压境，孙刘联盟既成。万事俱备，只欠东风。',
    finale: '赤壁一炬，天下三分。曹操北归，孙权坐镇江东，刘备跨有荆襄——鼎立之势成矣。',
    stages: [
      { name: '大军压境', narration: '曹军八十三万，水陆并进，旌旗蔽日，直指江东。',
        foes: ['caimao', 'wenpin', 'yujin', 'lidian', 'guohuai'] },
      { name: '蒋干盗书', narration: '蒋干渡江说周瑜，周瑜将计就计，一封假书教曹操亲手斩了水军都督。',
        foes: ['jianggan', 'caimao', 'wenpin', 'yujin', 'lidian'] },
      { name: '草船借箭', narration: '大雾漫江，草船擂鼓。二十只草船，借得十万羽箭。',
        foes: ['caimao', 'wenpin', 'yujin', 'lidian', 'guohuai'] },
      { name: '苦肉计', narration: '周瑜打黄盖，一个愿打，一个愿挨。诈降之计已成。',
        foes: ['wenpin', 'yujin', 'lidian', 'guohuai', 'manchong'] },
      { name: '火烧赤壁', narration: '东风起，火船直入曹军水寨——八十三万大军，灰飞烟灭。',
        foes: ['caimao', 'wenpin', 'yujin', 'manchong', 'guohuai'] },
      { name: '败走华容', narration: '曹操败走华容道，泥泞没膝，人马自相践踏。',
        foes: ['caocao', 'xuchu', 'zhangliao', 'xuhuang', 'guohuai'] },
      { name: '华容道义释', narration: '关羽横刀立马于华容道。曹操求义，关公长叹，放其生路。',
        dialogue: [
          { who: 'caocao', text: '云长别来无恙？某兵败势危，望将军以旧情为重。' },
          { who: 'guanyu', text: '斩颜良诛文丑，已报丞相之恩。今日一别，两不相欠！' },
        ],
        foes: ['caocao', 'xuchu', 'zhangliao', 'xuhuang', 'yujin'] },
      { name: '南郡之争', narration: '曹仁退守南郡，周瑜与诸葛亮各设奇谋，荆州归属暗流涌动。',
        foes: ['caoren', 'yujin', 'manchong', 'guohuai', 'lidian'] },
      { name: '荆襄归附', narration: '零陵、桂阳、武陵、长沙四郡望风归附，刘备终得立足之地。',
        foes: ['caohong', 'yuejin', 'lidian', 'manchong', 'guohuai'] },
      { name: '曹操·横槊赋诗', narration: '大战之前，曹操横槊赋诗，骄兵之态尽在杯中。',
        dialogue: [
          { who: 'caocao', text: '对酒当歌，人生几何！今揽八十三万大军，何惧周瑜小儿！' },
          { who: 'liubei', text: '骄兵必败。丞相杯中酒，怕是要凉了。' },
        ],
        foes: ['caocao', 'xuchu', 'zhangliao', 'xuhuang', 'wenpin'] }
    ]
  },
  {
    id: 'ch08', name: '汉中之战', subtitle: '定军山 · 黄忠斩夏侯渊',
    intro: '曹操坐拥汉中，虎视益州。老将黄忠宝刀不老，定军山下有一场好戏。',
    finale: '曹操败退斜谷，汉中尽归刘备。进位汉中王——蜀汉基业，至此鼎盛。',
    stages: [
      { name: '西线烽烟', narration: '曹操平定汉中，留夏侯渊、张郃镇守，虎视益州。',
        foes: ['xiahouyuan', 'zhanghe', 'caohong', 'caozhen', 'guohuai'] },
      { name: '张郃犯境', narration: '张郃攻巴西，与张飞大战瓦口关。',
        foes: ['zhanghe', 'caohong', 'guohuai', 'caozhen', 'xiahouyuan'] },
      { name: '智取瓦口', narration: '张飞小路奇兵，前后夹击，三万精兵折损殆尽。',
        foes: ['zhanghe', 'guohuai', 'caozhen', 'caohong', 'manchong'] },
      { name: '天荡山', narration: '黄忠、严颜老将请缨，天荡山一战，火烧敌粮。',
        foes: ['caohong', 'guohuai', 'caozhen', 'manchong', 'xiahouyuan'] },
      { name: '定军山前', narration: '定军山对峙，法正山顶挥旗为号，黄忠引兵待发。',
        foes: ['xiahouyuan', 'zhanghe', 'caohong', 'caozhen', 'guohuai'] },
      { name: '阵斩妙才', narration: '法正举旗，黄忠一马当先。夏侯渊措手不及，被连头带肩砍为两段。',
        foes: ['xiahouyuan', 'zhanghe', 'caohong', 'guohuai', 'manchong'] },
      { name: '汉水拒敌', narration: '曹操大军至汉中，为夏侯渊复仇，粮草尽屯北山。',
        foes: ['caohong', 'guohuai', 'caozhen', 'manchong', 'zhanghe'] },
      { name: '空营计', narration: '赵云大开营门，偃旗息鼓。曹军疑有伏兵，自相践踏，堕汉水者无数。「子龙一身都是胆也！」',
        foes: ['xuchu', 'zhanghe', 'caohong', 'guohuai', 'manchong'] },
      { name: '斜谷对峙', narration: '曹操亲提大军四十万来争汉中，士气却已尽丧。',
        foes: ['caocao', 'xuchu', 'zhanghe', 'caohong', 'guohuai'] },
      { name: '曹操·亲征汉中', narration: '曹操亲临阵前，要为大将复仇。老将黄忠横刀，宝刀未老。',
        dialogue: [
          { who: 'caocao', text: '老卒焉能斩吾大将！今吾亲至，汉中必不失！' },
          { who: 'huangzhong', text: '定军山上，妙才已试过俺的刀。丞相，可要也试试？' },
        ],
        foes: ['caocao', 'xuchu', 'zhanghe', 'caohong', 'guohuai'] }
    ]
  },
  {
    id: 'ch09', name: '荆州易帜', subtitle: '白衣渡江 · 败走麦城',
    intro: '水淹七军，威震华夏。然而烽火台看不见的地方，白衣商人正在渡江。',
    finale: '荆州易帜，大将星陨。刘备恨极，起倾国之兵东征——夷陵的火，将把两家的国运一起烧尽。',
    stages: [
      { name: '单刀赴会', narration: '鲁肃设宴索荆州，帐后暗伏刀斧手。关羽单刀赴会，谈笑而归。',
        foes: ['handang', 'panzhang', 'zhuran', 'dingfeng', 'lingtong'] },
      { name: '水淹七军', narration: '秋雨连绵，汉水暴涨。关羽决堰放水，于禁投降，庞德死战。',
        foes: ['yujin', 'pangde', 'caozhen', 'guohuai', 'manchong'] },
      { name: '刮骨疗毒', narration: '华佗刮骨疗毒，关羽饮酒食肉，谈笑弈棋。而江上，吕蒙已换上白衣。',
        foes: ['lvmeng', 'handang', 'panzhang', 'zhuran', 'dingfeng'] },
      { name: '白衣渡江', narration: '精兵尽伏船中，摇橹者皆作商人打扮，昼夜兼行，烽火台尽数被赚。',
        foes: ['lvmeng', 'luxun', 'handang', 'zhuran', 'xusheng'] },
      { name: '江陵失守', narration: '后院起火，江陵易帜。荆州腹背受敌，大势已去。',
        foes: ['lvmeng', 'handang', 'panzhang', 'xusheng', 'dingfeng'] },
      { name: '退守麦城', narration: '孤城麦城，四望皆敌，求援的使者一去不回。',
        foes: ['luxun', 'handang', 'panzhang', 'zhuran', 'xusheng'] },
      { name: '突围麦城', narration: '夜出麦城，吴军伏兵四起。青龙偃月，且战且走。',
        foes: ['panzhang', 'zhuran', 'dingfeng', 'xusheng', 'lingtong'] },
      { name: '临沮之殇', narration: '临沮小道，伏兵尽起。纵横天下三十年的大将，终究没能等到益州的援兵。虽败，犹荣。',
        foes: ['panzhang', 'zhuran', 'dingfeng', 'xusheng', 'handang'] },
      { name: '誓师东征', narration: '刘备尽起益州之兵，誓报荆州之仇，直指江东。',
        foes: ['luxun', 'zhoutai', 'handang', 'zhuran', 'xusheng'] },
      { name: '吕蒙·白衣渡江', narration: '吕蒙亲率水军截杀于江上。一别经年，再无回旋余地。',
        dialogue: [
          { who: 'lvmeng', text: '关羽用兵，天下无对。然荆州不取，江东永无宁日。' },
          { who: 'guanyu', text: '碧眼鼠辈，背盟偷袭！关某纵横天下三十年，今日之败，非战之罪！' },
        ],
        foes: ['lvmeng', 'luxun', 'panzhang', 'zhuran', 'handang'] }
    ]
  },
  {
    id: 'ch10', name: '火烧连营', subtitle: '夷陵 · 书生拜将',
    intro: '桃园之誓犹在耳，二弟三弟相继惨亡。七十万大军东征，连营七百里。',
    finale: '夷陵火熄，白帝托孤。吴蜀重修旧好，共抗曹魏——南中却在此时反了。',
    stages: [
      { name: '东征誓师', narration: '大军东征，旌旗五十里。此战，为兄弟，也为荆州。',
        foes: ['zhoutai', 'xusheng', 'dingfeng', 'lingtong', 'zhuran'] },
      { name: '初战告捷', narration: '吴军先锋连败，蜀军夺旗斩将，气势如虹。',
        foes: ['lingtong', 'dingfeng', 'xusheng', 'zhuran', 'zhoutai'] },
      { name: '书生拜帅', narration: '阚泽以全家保举陆逊。书生拜大都督，诸将哗然。',
        foes: ['luxun', 'zhoutai', 'xusheng', 'dingfeng', 'lingtong'] },
      { name: '诱敌深入', narration: '陆逊坚守不战，退让山地七百里，诸将皆笑其怯。',
        foes: ['luxun', 'zhoutai', 'zhuran', 'xusheng', 'dingfeng'] },
      { name: '连营七百里', narration: '蜀军树木栅立营，连营七百里，皆依山傍林——兵家大忌。',
        foes: ['luxun', 'zhoutai', 'zhuran', 'handang', 'xusheng'] },
      { name: '火烧连营', narration: '一声令下，火乘风势，连营七百里尽成火海。',
        foes: ['luxun', 'zhuran', 'zhoutai', 'handang', 'dingfeng'] },
      { name: '马鞍山血战', narration: '陆逊督促诸将四面围攻，蜀军土崩瓦解。',
        foes: ['luxun', 'zhoutai', 'zhuran', 'xusheng', 'lingtong'] },
      { name: '白帝托孤', narration: '先帝退守白帝城，一病不起：「若嗣子可辅则辅之，如其不才，君可自取。」',
        foes: ['zhoutai', 'zhuran', 'dingfeng', 'xusheng', 'lingtong'] },
      { name: '八阵迷途', narration: '陆逊穷追，误入八阵图，飞沙走石，方知卧龙之能，罢兵而还。',
        foes: ['luxun', 'zhoutai', 'handang', 'zhuran', 'xusheng'] },
      { name: '陆逊·书生拜将', narration: '少年书生，一战成名。火光映着江水，映着两败俱伤的天下。',
        dialogue: [
          { who: 'luxun', text: '书生统兵，诸位不服。今日火起，可服否？' },
          { who: 'zhugeliang', text: '陆伯言火烧连营，亮在成都，亦为之叹服。' },
        ],
        foes: ['luxun', 'zhoutai', 'zhuran', 'handang', 'xusheng'] }
    ]
  },
  {
    id: 'ch11', name: '南征南中', subtitle: '七擒孟获',
    intro: '南中三郡皆反，蛮王孟获拥众十万犯境。丞相亲征——这一战，攻心为上。',
    finale: '南中已定，物阜民丰。丞相上出师表，六出祁山——这是他最后的执念。',
    stages: [
      { name: '南中烽火', narration: '三郡皆反，蛮兵十万犯境。诸葛亮奏准后主，亲率大军南征。',
        foes: ['menghuo', 'zhurong', 'yuji', 'zuoci', 'jiling'] },
      { name: '一擒孟获', narration: '银坑洞前设伏，一擒孟获。孟获不服：「山中误中埋伏，不服！」',
        foes: ['menghuo', 'yuji', 'zuoci', 'jiling', 'zhurong'] },
      { name: '泸水之险', narration: '泸水滔滔，瘴气弥天。奇兵夜渡，直插蛮军后路。',
        foes: ['zhurong', 'yuji', 'zuoci', 'jiling', 'menghuo'] },
      { name: '二擒三纵', narration: '诈降者被识破，兄弟俱擒。放归于江边，再战。',
        foes: ['menghuo', 'zhurong', 'yuji', 'zuoci', 'jiling'] },
      { name: '弃盔而逃', narration: '蛮兵诈败诱敌，反被将计就计。孟获弃盔而逃，又被擒于涧边。',
        foes: ['menghuo', 'zhurong', 'jiling', 'yuji', 'zuoci'] },
      { name: '藤甲军至', narration: '乌戈国藤甲军渡江而来，刀箭不入——油浸藤甲，遇火则燃。',
        foes: ['menghuo', 'zhurong', 'yuji', 'zuoci', 'jiling'] },
      { name: '火烧盘蛇谷', narration: '盘蛇谷中火起，三万藤甲军无一走脱。丞相垂泪：「吾虽有功，必损寿矣。」',
        foes: ['menghuo', 'zhurong', 'yuji', 'zuoci', 'jiling'] },
      { name: '七擒七纵', narration: '孟获再无兵可用，单骑冲阵，第七次被擒。',
        foes: ['menghuo', 'zhurong', 'jiling', 'yuji', 'zuoci'] },
      { name: '南人不复反', narration: '孟获垂泪拜伏：「丞相天威，南人不复反矣！」仍以其为王，蛮地感恩。',
        foes: ['zhurong', 'yuji', 'zuoci', 'jiling', 'menghuo'] },
      { name: '孟获·南蛮演武', narration: '孟获感丞相之义，愿率本部与蜀军演武一场，以示永不复反。',
        dialogue: [
          { who: 'menghuo', text: '七擒七纵，自古未有。丞相之恩，获万死不赎！' },
          { who: 'zhugeliang', text: '攻心为上，攻城为下。南中之安，在人心不在刀兵。' },
        ],
        foes: ['menghuo', 'zhurong', 'yuji', 'zuoci', 'jiling'] }
    ]
  },
  {
    id: 'ch12', name: '星落五丈原', subtitle: '六出祁山 · 将星陨落',
    intro: '「鞠躬尽瘁，死而后已。」六出祁山，北伐中原，这是丞相最后的执念。',
    finale: '将星陨落，鼓声渐远。出师未捷身先死，长使英雄泪满襟——而丞相的忠诚，永照后人。',
    stages: [
      { name: '出师北伐', narration: '出师表上，字字泣血。大军出祁山，直指长安。',
        foes: ['simayi', 'zhanghe', 'haozhao', 'guohuai', 'manchong'] },
      { name: '陈仓之坚', narration: '郝昭千余人守陈仓，云梯冲车二十日尽出，竟不能克。',
        foes: ['haozhao', 'guohuai', 'manchong', 'zhanghe', 'caozhen'] },
      { name: '天水收姜维', narration: '天水城下收姜维。丞相大喜：「吾所得，不过一姜伯约。」',
        foes: ['zhanghe', 'haozhao', 'guohuai', 'caozhen', 'manchong'] },
      { name: '木门道', narration: '张郃追击至木门道，万弩齐发——一代名将，殁于乱箭。司马懿闻之，不悲反喜。',
        foes: ['zhanghe', 'guohuai', 'haozhao', 'caozhen', 'manchong'] },
      { name: '上方谷', narration: '司马懿父子被诱入上方谷，火起封谷口——天降大雨，满谷之火尽浇灭。「谋事在人，成事在天！」',
        foes: ['simayi', 'simashi', 'simazhao', 'guohuai', 'haozhao'] },
      { name: '空城计', narration: '十五万大军至西城，城头焚香操琴，城门大开——疑有埋伏，大军退去。',
        dialogue: [
          { who: 'simayi', text: '亮平生谨慎，不曾弄险。今城门大开，必有埋伏！' },
          { who: 'zhugeliang', text: '吾非行险，实无兵可派耳。司马仲达，终究不懂我。' },
        ],
        foes: ['simayi', 'simashi', 'simazhao', 'guohuai', 'manchong'] },
      { name: '五丈原对峙', narration: '五丈原上，蜀魏对峙百日。司马懿坚壁不出，以逸待劳。',
        foes: ['simayi', 'guohuai', 'haozhao', 'caozhen', 'manchong'] },
      { name: '巾帼之辱', narration: '送巾帼妇人之衣以激战。司马懿佯笑受之，只问丞相寝食：「食少事烦，其能久乎？」',
        foes: ['simayi', 'simashi', 'guohuai', 'haozhao', 'manchong'] },
      { name: '秋风五丈原', narration: '建兴十二年秋，大星坠于五丈原。将星陨落，汉室最后的擎天之柱，倒了。',
        foes: ['simayi', 'simashi', 'simazhao', 'guohuai', 'haozhao'] },
      { name: '星落五丈原', narration: '秋风瑟瑟，命灯将熄。司马懿夜观星象，笑曰：「将星坠落，孔明命不久矣！」——蜀军最后的冲锋，为丞相而战。',
        dialogue: [
          { who: 'simayi', text: '诸葛亮！汝食少事烦，命灯已暗——何不下马归降，保全性命？' },
          { who: 'zhugeliang', text: '汉贼不两立，王业不偏安！纵使将星陨落，北伐之志，至死不退！' },
        ],
        foes: ['simayi', 'simashi', 'simazhao', 'guohuai', 'haozhao'] }
    ]
  },
  {
    id: 'ch13', name: '三分归晋', subtitle: '天下大势 · 分久必合',
    intro: '魏蜀吴三国鼎立，英雄迟暮。然天下大势，分久必合，新的乱世序幕悄然拉开。',
    finale: '三国归晋，乱世终结。然英雄的故事，永不落幕。',
    stages: [
      { name: '淮南三叛', narration: '淮南烽烟再起，诸葛诞据城固守，魏军围困数重。',
        foes: ['caocao', 'simayi', 'zhangliao', 'xuchu', 'chengong'] },
      { name: '铁笼山', narration: '铁笼山险峻，司马昭被困，蜀军截击魏军援兵。',
        foes: ['simayi', 'caoren', 'zhanghe', 'xuhuang', 'liru'] },
      { name: '羌兵援魏', narration: '羌兵铁骑来援，西凉尘土飞扬，蜀军严阵以待。',
        foes: ['machao', 'pangde', 'huangzhong', 'weiyan', 'jiangwei'] },
      { name: '剑阁天险', narration: '剑阁天险一夫当关，钟会大军止步关前。',
        foes: ['jiangwei', 'zhugeliang', 'machao', 'huangzhong', 'pangtong'] },
      { name: '屯田沓中', narration: '沓中屯田，姜维养精蓄锐，魏军探马来报。',
        foes: ['jiangwei', 'zhugeliang', 'machao', 'huatuo', 'liru'] },
      { name: '阴平偷渡', narration: '邓艾偷渡阴平，七百里无人区，蜀军腹背受敌。',
        foes: ['simayi', 'caocao', 'xuhuang', 'liru', 'chengong'] },
      { name: '绵竹之战', narration: '绵竹最后防线，诸葛瞻父子殉国，蜀汉危在旦夕。',
        foes: ['zhugeliang', 'jiangwei', 'machao', 'huangzhong', 'pangtong'] },
      { name: '成都降魏', narration: '后主出降，蜀汉灭亡。姜维一计害三贤，壮志未酬。',
        foes: ['jiangwei', 'zhugeliang', 'liubei', 'guanyu', 'zhangfei'] },
      { name: '吴宫残照', narration: '吴国朝政日非，孙皓暴虐，晋军六路伐吴。',
        foes: ['sunce', 'ganning', 'taishici', 'zhouyu', 'luxun'] },
      { name: '三分归晋', narration: '王濬楼船下益州，金陵王气黯然收。三分归一统，天下大势定。',
        dialogue: [
          { who: 'simayi', text: '天下大势，分久必合，合久必分。今日三国归晋，乱世终结！' },
          { who: 'liubei', text: '英雄迟暮，然忠义千秋。这三国的故事，流传百世！' }
        ],
        foes: ['simayi', 'simazhao', 'simashi', 'guohuai', 'haozhao'] }
    ]
  },
  {
    id: 'ch14', name: '群英梦影', subtitle: '英魂不灭 · 再战三国',
    intro: '三分归晋，然英雄魂魄不灭。梦中重回三国战场，与昔年对手再决高下。',
    finale: '梦醒时分，英雄已远。但那面战旗，仍在心中飘扬。',
    stages: [
      { name: '虎牢关再战', narration: '梦回虎牢关，三英战吕布，枪来刀往如当年。',
        foes: ['lvbu', 'huaxiong', 'diaochan', 'dongzhuo', 'jiling'] },
      { name: '官渡旧地', narration: '官渡旧地重游，曹操袁绍旧部在此列阵相迎。',
        foes: ['yuanshao', 'caocao', 'guojia', 'zhanghe', 'liru'] },
      { name: '赤壁余烬', narration: '赤壁江面火光依旧，东风再起，樯橹灰飞烟灭。',
        foes: ['zhouyu', 'luxun', 'huanggai', 'ganning', 'taishici'] },
      { name: '长坂坡前', narration: '长坂坡前一声吼，常山赵子龙七进七出！',
        foes: ['zhaoyun', 'guanyu', 'zhangfei', 'machao', 'huangzhong'] },
      { name: '华容道口', narration: '华容道口云雾迷蒙，昔日恩怨在此了结。',
        foes: ['guanyu', 'caocao', 'simayi', 'zhangliao', 'xuchu'] },
      { name: '五丈原秋风', narration: '五丈原秋风萧瑟，出师未捷身先死，长使英雄泪满襟。',
        foes: ['zhugeliang', 'jiangwei', 'machao', 'huatuo', 'pangtong'] },
      { name: '街亭遗恨', narration: '街亭失守挥泪斩马谡，武侯泪如雨下。',
        foes: ['jiangwei', 'zhugeliang', 'machao', 'huangzhong', 'pangtong'] },
      { name: '麦城残阳', narration: '麦城残阳如血，武圣走麦城，千古悲歌。',
        foes: ['guanyu', 'guanping', 'jiangwei', 'lvmeng', 'luxun'] },
      { name: '白帝托孤', narration: '白帝城托孤，先主泣血嘱托，君臣之义至死不渝。',
        foes: ['liubei', 'zhugeliang', 'guanyu', 'zhangfei', 'zhaoyun'] },
      { name: '英雄终章', narration: '英雄终章——所有三国英魂在此集结，最终之战一触即发！',
        dialogue: [
          { who: 'lvbu', text: '吾乃飞将吕布！今日英雄集结，谁能挡我？！' },
          { who: 'liubei', text: '天下英雄谁敌手？曹刘！今天就让我等再决高下！' },
          { who: 'zhangfei', text: '哈哈！俺老张的丈八蛇矛早已饥渴难耐了！' }
        ],
        foes: ['lvbu', 'caocao', 'sunce', 'zhugeliang', 'simayi'] }
    ]
  },
  {
    id: 'ch15', name: '乱世再临', subtitle: '梦醒 · 烽烟又起',
    intro: '梦醒之后，天下并未太平。黄巾余烬复燃，四方贼寇并起，边地狼烟再度席卷中原。',
    finale: '草原之主授首，边患暂平。然狼烟未熄，真正的天命之争才刚开场。',
    stages: [
      { name: '黄巾复起', narration: '黄巾余烬复燃，张角残部再举妖旗，中原烽烟又起。',
        foes: ['zhangjiao', 'yuji', 'jiling', 'gongsunzan', 'yangxiu'] },
      { name: '白波余寇', narration: '白波贼众啸聚山谷，劫掠州郡，其势复张。',
        foes: ['yuanshu', 'chengong', 'jiling', 'liru', 'yuji'] },
      { name: '黑山匪众', narration: '黑山军依险为巢，飞燕出入太行，官军莫能制。',
        foes: ['dongzhuo', 'liru', 'huaxiong', 'gaoshun', 'caohong'] },
      { name: '西凉叛军', narration: '西凉铁骑叛乱再起，尘头蔽日，兵锋直指长安。',
        foes: ['pangde', 'caozhen', 'caohong', 'xiahouyuan', 'haozhao'] },
      { name: '南匈奴犯边', narration: '南匈奴部众南渡犯边，袁氏余党借虏势再起波澜。塞外飞将与凉州骁将并辔而来。',
        foes: ['machao', 'pangde', 'lvbu', 'yuanshao', 'dongzhuo'] },
      { name: '山越啸聚', narration: '山越部族啸聚山林，江东豪姓借征伐之名扩部曲，六县为之震动。',
        foes: ['panzhang', 'xusheng', 'zhoutai', 'lvmeng', 'luxun'] },
      { name: '武陵蛮乱', narration: '武陵蛮王反叛，妖道贼众裹挟蛮兵北上，荆南告急。',
        foes: ['menghuo', 'zhurong', 'zhangjiao', 'yuji', 'jiling'] },
      { name: '羌胡扣关', narration: '羌胡铁骑扣关而入，边地降将裹挟胡骑，凉州烽火连天。',
        foes: ['machao', 'pangde', 'gaoshun', 'huaxiong', 'caohong'] },
      { name: '乌桓踏塞', narration: '乌桓铁骑踏塞而入，袁氏残党与之勾结，幽州危急。',
        foes: ['yuanshao', 'yuanshu', 'wenchou', 'yanliang', 'gongsunzan'] },
      { name: '草原之主', narration: '草原之主亲率王庭精骑南下，决战塞外——大汉的旗帜不容践踏！',
        dialogue: [
          { who: 'machao', text: '西凉铁骑，天下无双！今日便让尔等见识塞外雄风！' },
          { who: 'zhaoyun', text: '贼寇犯边，寸土不让！枪出如龙，破敌于阵前！' }
        ],
        foes: ['machao', 'pangde', 'yuji', 'zhangjiao', 'dongzhuo'] }
    ]
  },
  {
    id: 'ch16', name: '天命之战', subtitle: '群雄逐鹿 · 终章',
    intro: '异族既平，群雄再聚。五路大军同时发难，逐鹿天下——天命之战，全面爆发。',
    finale: '五路皆平，天命归于仁德。三国的传奇，将由主公亲手续写。',
    stages: [
      { name: '北路·并州狼骑', narration: '并州狼骑自北路南下，飞将吕布一马当先，铁蹄所至寸草不生。',
        foes: ['lvbu', 'zhangliao', 'gaoshun', 'liru', 'chengong'] },
      { name: '东路·江东猛火', narration: '江东猛火顺流而起，小霸王孙策亲率水陆军直扑中路。',
        foes: ['sunce', 'zhouyu', 'ganning', 'taishici', 'huanggai'] },
      { name: '西路·西凉铁壁', narration: '西凉铁壁横亘西路，锦马超据险而守，一夫当关。',
        foes: ['machao', 'pangde', 'xiahouyuan', 'caozhen', 'haozhao'] },
      { name: '南路·南蛮象阵', narration: '南蛮象阵自南路压来，地动山摇，蛮王孟获卷土重来。',
        foes: ['menghuo', 'zhurong', 'zhuran', 'dingfeng', 'panzhang'] },
      { name: '中路·中原霸主', narration: '中原霸主亲率虎豹之师坐镇中路，霸王之业，在此一举。',
        foes: ['caocao', 'simayi', 'xuchu', 'yuejin', 'guojia'] },
      { name: '官渡再举', narration: '官渡旧战场再燃烽火，四世三公的家底倾巢而出。',
        foes: ['yuanshao', 'wenchou', 'yanliang', 'xuyou', 'zhanghe'] },
      { name: '赤壁再燃', narration: '赤壁江面再起东风，火攻之计更胜当年。',
        foes: ['zhouyu', 'luxun', 'lvmeng', 'huanggai', 'ganning'] },
      { name: '五丈原对峙', narration: '五丈原上秋风又起，卧龙与冢虎的宿命对决再续。',
        foes: ['zhugeliang', 'pangtong', 'jiangwei', 'weiyan', 'simayi'] },
      { name: '虎牢关破', narration: '虎牢关最终告破，人中美吕、马中赤兔，最后一舞。',
        foes: ['lvbu', 'huaxiong', 'dongzhuo', 'diaochan', 'liru'] },
      { name: '天命所归', narration: '群英集结，天命之战最终章——胜者执掌天下，败者湮没于尘！',
        dialogue: [
          { who: 'lvbu', text: '天命？我吕布的命，从来只由自己执掌！' },
          { who: 'liubei', text: '天命归于仁德！众将听令——随我终结这场乱世！' },
          { who: 'guanyu', text: '云长在此，青龙偃月，为天下苍生而战！' }
        ],
        foes: ['lvbu', 'zhugeliang', 'simayi', 'zhouyu', 'guanyu'] }
    ]
  }
];

// 乱世循环 Boss 对白（研讨会六 C4）：161 关后每章末名将合成剧情，按乱世章序从池中轮换。
// 纯派生不落存档；对白为原创幽灵重演主题，who 引用真实武将 id。
// 乱世 Boss 轮换池（内容多样性：避免每章都是吕布）：按乱世章序轮换，对白各说各话
const CHAOS_BOSS_ROTATION = ['lvbu', 'caocao', 'zhugeliang', 'simayi', 'zhouyu', 'sunce'];
const CHAOS_BOSS_STORY = {
  lvbu: { stage: { name: '魔影重演', narration: '倒下的身影再度立起，眼底燃着不散的执念——乱世也不愿谢幕。',
      dialogue: [
        { who: 'lvbu', text: '又是我？也好——这乱世本来就没记住几个名字。' },
        { who: 'guanyu', text: '那便再胜你一次，直到天下记住为止。' }
      ] } },
  caocao: { stage: { name: '旧梦重临', narration: '铜雀台影在硝烟里若隐若现，横槊之人笑声如旧。',
      dialogue: [
        { who: 'caocao', text: '对酒当歌。人生几何——再来一局又何妨？' },
        { who: 'liubei', text: '这一局，为的是白骨露于野的百姓。' }
      ] } },
  zhugeliang: { stage: { name: '秋风又满五丈原', narration: '将星摇曳，羽扇再出——灯还亮着，人就未败。',
      dialogue: [
        { who: 'zhugeliang', text: '亮观此阵，虚实相生——是考验，不是埋伏。' },
        { who: 'simayi', text: '丞相放心，仲达这局只守不攻。' }
      ] } },
  simayi: { stage: { name: '鹰视狼顾', narration: '耐心的猎手这一次站在了明处，眼神依旧是只鹰。',
      dialogue: [
        { who: 'simayi', text: '循环？我等的就是循环——每一次，都比上次更有耐心。' },
        { who: 'zhugeliang', text: '耐心再久，也熬不过天下人的眼睛。' }
      ] } },
  zhouyu: { stage: { name: '东风又起', narration: '江面火光未冷，曲有误的传闻再次流转水寨。',
      dialogue: [
        { who: 'zhouyu', text: '东风起了。这一次，周郎先出手。' },
        { who: 'zhugeliang', text: '都督请——亮这一次不借，只战。' }
      ] } },
  sunce: { stage: { name: '小霸王的答卷', narration: '江东基业替故人年少，这一局由孙郎亲手收官。',
      dialogue: [
        { who: 'sunce', text: '江东的基业替我继续年少，这局我来收尾。' },
        { who: 'zhouyu', text: '主公出枪，公瑾押阵——如当年。' }
      ] } }
};
function getChaosStory(globalStage) {
  const n = Math.floor(Number(globalStage) || 0);
  const loop = Math.floor((n - 1) / 10) - (CHAPTERS.length - 1); // 乱世章序（1 起）
  if (loop < 1) return null;
  const bossId = CHAOS_BOSS_ROTATION[(loop - 1) % CHAOS_BOSS_ROTATION.length];
  const entry = CHAOS_BOSS_STORY[bossId];
  return { ch: { name: '乱世纷争 · 第' + loop + '章' }, chIdx: Math.floor((n - 1) / 10), inCh: (n - 1) % 10,
    stage: { name: entry.stage.name, narration: entry.stage.narration, dialogue: entry.stage.dialogue, foes: null },
    isBoss: true, synthetic: true, chaosBoss: bossId };
}

// 全局关卡序号（1 起）→ 剧情配置；超出本表（>160 关）返回 null，调用方走循环乱世兜底
function getStoryStage(globalStage) {
  if (globalStage < 1 || globalStage > CHAPTERS.length * 10) return null;
  const chIdx = Math.floor((globalStage - 1) / 10);
  const inCh = (globalStage - 1) % 10;
  const ch = CHAPTERS[chIdx];
  return { ch, chIdx, inCh, stage: ch.stages[inCh], isBoss: inCh === 9 };
}

function getStoryChapter(chIdx) {
  return CHAPTERS[chIdx] || null;
}

module.exports = { CHAPTERS, getStoryStage, getStoryChapter, getChaosStory, CHAOS_BOSS_ROTATION };
