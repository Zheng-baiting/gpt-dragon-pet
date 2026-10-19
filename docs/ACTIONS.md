# 动作目录

参考 PC2005-cloud/dsh-pet 的固定版本 `6c5f04321be050525b5cbb7bb8ee5f53e89deb6f`。全部入口已映射，播放方式为「处理后的连续基础片段 + 程序运动 + 可选道具」。同一基础片段被多个动作复用，不能等同于 106 段独立视频。

下表的基础帧编号对应原始图集的行号，从 1 起；1.0 运行时读取 `assets/animation/` 的处理片段，通常每段包含 72 帧，待机片段为 120 帧。它们含 12 帧进入和 12 帧退出共同站姿，按各段时间表播放；点击类只播放一次。余额类仅作预览，没有读取余额的功能。

| 分类 | 本项目动作 | 上游名称 | 基础帧 | 运动 / 道具 |
| --- | --- | --- | --- | --- |
| 待机 | 待机呼吸休闲 | 待机呼吸休闲 | core · 1 | idle |
| 转向 | 东张西望 | 东张西望 | move · 4 | turn |
| 拖拽 | 被鼠标拖拽悬空反馈 | 被鼠标拖拽悬空反馈 | emotion · 4 | drag |
| 点击回应 | 点击回应-开心跃动 | 点击回应-开心跃动 | core · 2 | jump / hearts |
| 点击回应 | 点击回应-害羞惊讶 | 点击回应-害羞惊讶 | emotion · 1 | shy / hearts |
| 点击回应 | 点击回应-傲娇生气 | 点击回应-傲娇生气 | emotion · 2 | pout / sweat |
| 点击回应 | 点击回应-挠痒咯咯笑 | 点击回应-挠痒咯咯笑 | emotion · 3 | tickle / sparkles |
| 点击回应 | 点击回应-元气挥手 | 点击回应-元气挥手 | core · 2 | wave / stars |
| 移动 | 螃蟹走路 | 螃蟹走路 | move · 1 | crabwalk |
| 移动 | 原地漂浮踏步 | 原地漂浮踏步 | move · 1 | float / bubbles |
| 移动 | 原地左转奔跑 | 原地左转奔跑 | move · 2 | run |
| 小动作 | 悠闲哼歌 | 悠闲哼歌 | move · 3 | sway / notes |
| 小动作 | 超大伸懒腰 | 超大伸懒腰 | life · 2 | stretch |
| 小动作 | 原地敲击桌面互动 | 原地敲击桌面互动 | life · 4 | tap / desk |
| 小动作 | 原地重力下蹲压缩 | 原地重力下蹲压缩 | emotion · 3 | squat |
| 小动作 | 哈欠连天 | 哈欠连天 | life · 2 | yawn / sleep |
| 小动作 | 原地小憩沉眠 | 原地小憩沉眠 | life · 1 | sleep / sleep |
| 小动作 | 女仆屈膝礼仪 | 女仆屈膝礼仪 | life · 3 | bow |
| 小动作 | 被吓一跳 | 被吓一跳 | emotion · 4 | surprise / stars |
| 小动作 | 小幅度原地360度旋转展示 | 小幅度原地360度旋转展示 | move · 4 | spin / sparkles |
| 小动作 | 偷吃零食被抓住 | 偷吃零食被抓住 | emotion · 1 | shy / snacks |
| 小动作 | 用龙尾巴拍打地面 | 用鲸鱼尾巴拍打地面 | move · 4 | tail / dust |
| 小动作 | 打瞌睡被惊醒 | 打瞌睡被惊醒 | life · 1 | wake / stars |
| 小动作 | 照镜子 | 照镜子 | life · 4 | inspect / mirror |
| 小动作 | 整体换装试色 | 整体换装试色 | move · 4 | spin / palette |
| 小动作 | 轻快记录 | 轻快记录 | life · 4 | write / notebook |
| 小动作 | 写代码 | 写代码 | core · 4 | type |
| 小动作 | 摇扇纳凉 | 摇扇纳凉 | life · 4 | fan / fan |
| 小动作 | 晨间刷牙 | 晨间刷牙 | life · 4 | brush / toothbrush |
| 玩耍 | 原地专心玩魔方 | 原地专心玩魔方 | life · 4 | play / cube |
| 玩耍 | 原地蹲下玩玩具汽车 | 原地蹲下玩玩具汽车 | emotion · 3 | squat / car |
| 玩耍 | 龙吐泡泡特效 | 鲸鱼吐泡泡特效 | life · 4 | blow / bubbles |
| 玩耍 | 原地跳跃抓碎头顶物品 | 原地跳跃抓碎头顶物品 | core · 2 | jump / starbreak |
| 玩耍 | 玩游戏气急败坏 | 玩游戏气急败坏 | emotion · 2 | pout / game |
| 玩耍 | 玩水枪 | 玩水枪 | life · 4 | shoot / watergun |
| 玩耍 | 小提琴演奏 | 小提琴演奏 | life · 4 | violin / violin |
| 玩耍 | 白龙现世 | 蓝鲸现世 | core · 2 | summon / dragon |
| 玩耍 | 优雅女仆舞 | 优雅女仆舞 | move · 3 | dance / sparkles |
| 玩耍 | 轻快摇摆舞 | 轻快摇摆舞 | move · 3 | sway / notes |
| 玩耍 | 可爱宅舞 | 可爱宅舞 | move · 3 | dance / hearts |
| 玩耍 | 吹气球 | 吹气球 | life · 4 | blow / balloon |
| 玩耍 | 动物环绕 | 动物环绕 | core · 1 | idle / animals |
| 玩耍 | 放风筝 | 放风筝 | life · 4 | kite / kite |
| 玩耍 | 拆礼物 | 拆礼物 | life · 4 | open / gift |
| 玩耍 | 变鸽子 | 变鸽子 | core · 2 | magic / bird |
| 玩耍 | 扑克魔术 | 扑克魔术 | life · 4 | magic / cards |
| 玩耍 | 抽陀螺 | 抽陀螺 | life · 4 | play / top |
| 玩耍 | 吹笛子 | 吹笛子 | life · 4 | flute / flute |
| 玩耍 | 蝴蝶蜜蜂环绕头顶开花 | 蝴蝶蜜蜂环绕头顶开花 | core · 1 | idle / flowers |
| 玩耍 | 撸猫 | 撸猫 | life · 4 | pet / cat |
| 玩耍 | 凭空生花 | 凭空生花 | core · 2 | magic / flower |
| 玩耍 | 骑木马 | 骑木马 | emotion · 3 | ride / horse |
| 玩耍 | 三球抛接 | 三球抛接 | life · 4 | juggle / balls |
| 玩耍 | 踢毽子 | 踢毽子 | move · 1 | kick / shuttle |
| 玩耍 | 下五子棋 | 下五子棋 | life · 4 | play / chess |
| 玩耍 | 荡秋千 | 荡秋千 | emotion · 3 | swing / swing |
| 吃什么 | 吃白饭 | 吃白饭 | life · 4 | eat / rice |
| 吃什么 | 大口吃零食 | 大口吃零食 | life · 4 | eat / snacks |
| 吃什么 | 补充灵感 | 吃Token | life · 4 | eat / token |
| 吃什么 | 吃早餐 | 吃早餐 | life · 4 | eat / breakfast |
| 吃什么 | 吃午餐 | 吃午餐 | life · 4 | eat / lunch |
| 吃什么 | 吃晚餐 | 吃晚餐 | life · 4 | eat / dinner |
| 吃什么 | 吃冰淇淋融化 | 吃冰淇淋融化 | life · 4 | lick / icecream |
| 吃什么 | 吃大闸蟹 | 吃大闸蟹 | life · 4 | eat / crab |
| 吃什么 | 吃糖葫芦 | 吃糖葫芦 | life · 4 | eat / tanghulu |
| 吃什么 | 吃长寿面 | 吃长寿面 | life · 4 | slurp / noodles |
| 吃什么 | 吃西瓜 | 吃西瓜 | life · 4 | eat / watermelon |
| 吃什么 | 涮火锅 | 涮火锅 | life · 4 | cook / hotpot |
| 时节 | 被落叶淹没 | 被落叶淹没 | emotion · 4 | surprise / leaves |
| 时节 | 中秋赏月吃月饼 | 中秋赏月吃月饼 | life · 4 | eat / moon |
| 时节 | 堆雪人 | 堆雪人 | life · 4 | build / snowman |
| 时节 | 放烟花 | 放烟花 | core · 2 | celebrate / fireworks |
| 时节 | 吃粽子 | 吃粽子 | life · 4 | eat / zongzi |
| 时节 | 吃年糕 | 吃年糕 | life · 4 | eat / niangao |
| 时节 | 吃青团 | 吃青团 | life · 4 | eat / qingtuan |
| 时节 | 吃腊八粥 | 吃腊八粥 | life · 4 | eat / porridge |
| 时节 | 吃重阳糕 | 吃重阳糕 | life · 4 | eat / chongyang |
| 时节 | 收红包 | 收红包 | core · 2 | wave / redpacket |
| 时节 | 写福字 | 写福字 | life · 4 | write / fu |
| 时节 | 穿针乞巧 | 穿针乞巧 | life · 4 | craft / needle |
| 时节 | 舞狮头 | 舞狮头 | move · 3 | dance / lion |
| 时节 | 讨糖南瓜灯 | 讨糖南瓜灯 | life · 4 | hold / pumpkin |
| 时节 | 插茱萸赏菊 | 插茱萸赏菊 | life · 4 | craft / chrysanthemum |
| 时节 | 放河灯 | 放河灯 | life · 3 | bow / riverlantern |
| 时节 | 萌化小幽灵 | 萌化小幽灵 | emotion · 4 | float / ghost |
| 时节 | 装点圣诞树 | 装点圣诞树 | life · 4 | build / tree |
| 时节 | 放孔明灯 | 放孔明灯 | core · 2 | release / lantern |
| 时节 | 吃汤圆 | 吃汤圆 | life · 4 | eat / tangyuan |
| 时节 | 吃饺子 | 吃饺子 | life · 4 | eat / dumplings |
| 文字 | 是啊，吃什么 | 是啊，吃什么 | core · 3 | think / foodthought |
| 文字 | 深度思考碎碎念 | 深度思考碎碎念 | core · 3 | think / thought |
| 余额档位 | 余额-钱袋满溢 | 余额-钱袋满溢 | core · 2 | celebrate / purse-full |
| 余额档位 | 余额-金袋叮当 | 余额-金袋叮当 | life · 4 | juggle / purse-gold |
| 余额档位 | 余额-钱袋如常 | 余额-钱袋如常 | life · 4 | hold / purse-normal |
| 余额档位 | 余额-数金皱眉 | 余额-数金皱眉 | core · 3 | think / purse-count |
| 余额档位 | 余额-袋空如洗 | 余额-袋空如洗 | emotion · 2 | pout / purse-empty |
| 余额档位 | 余额-分文不剩 | 余额-分文不剩 | emotion · 1 | shy / purse-zero |
| 碎碎念 | 碎碎念-擦桌碎碎念 | 碎碎念-擦桌碎碎念 | life · 4 | wipe / desk |
| 碎碎念 | 碎碎念-发呆碎碎念 | 碎碎念-发呆碎碎念 | core · 1 | idle / thought |
| 碎碎念 | 碎碎念-对屏碎碎念 | 碎碎念-对屏碎碎念 | core · 4 | type / notes |
| 工作状态 | 工作状态-思考冒泡 | 工作状态-思考冒泡 | core · 3 | think / thought |
| 工作状态 | 工作状态-忙碌点按 | 工作状态-忙碌点按 | core · 4 | type |
| 工作状态 | 工作状态-清点归档 | 工作状态-清点归档 | life · 4 | write / archive |
| 工作状态 | 工作状态-原地踱步张望 | 工作状态-原地踱步张望 | move · 1 | pace / thought |
| 工作状态 | 工作状态-雀跃庆祝 | 工作状态-雀跃庆祝 | core · 2 | celebrate / stars |
| 工作状态 | 工作状态-垂头叹气冒汗 | 工作状态-垂头叹气冒汗 | emotion · 1 | shy / sweat |
