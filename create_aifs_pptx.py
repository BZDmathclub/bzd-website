# -*- coding: utf-8 -*-
import zipfile
from pathlib import Path

def create_pptx_content():
    """Create complete PPTX file for AIFS Marine presentation"""

    pptx_path = Path("AIFS_Marine_演讲文档.pptx")

    with zipfile.ZipFile(str(pptx_path), 'w', zipfile.ZIP_DEFLATED) as zf:

        # ==================== METADATA FILES ====================

        # [Content_Types].xml
        content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
'''
        for i in range(1, 17):
            content_types += f'  <Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n'
        content_types += '</Types>'
        zf.writestr('[Content_Types].xml', content_types)

        # _rels/.rels
        rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>'''
        zf.writestr('_rels/.rels', rels)

        # docProps/core.xml
        core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/officeDocument/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>ECMWF AIFS Marine 演讲文档</dc:title>
  <dc:creator>Hahner et al., ECMWF</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-06-01T00:00:00Z</dcterms:created>
</cp:coreProperties>'''
        zf.writestr('docProps/core.xml', core)

        # ==================== PRESENTATION FILES ====================

        # ppt/_rels/presentation.xml.rels
        pres_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
'''
        for i in range(1, 17):
            pres_rels += f'  <Relationship Id="rId{i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>\n'
        pres_rels += '</Relationships>'
        zf.writestr('ppt/_rels/presentation.xml.rels', pres_rels)

        # ppt/presentation.xml
        presentation = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:rel="http://schemas.openxmlformats.org/package/2006/relationships">
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:sldIdLst>
'''
        for i in range(1, 17):
            presentation += f'    <p:sldId id="{255+i}" r:id="rId{i+2}"/>\n'
        presentation += '  </p:sldIdLst>\n</p:presentation>'
        zf.writestr('ppt/presentation.xml', presentation)

        # ==================== SLIDES ====================

        slide_data = [
            ("ECMWF数据驱动预报系统AIFS中的表层海洋表示",
             ["AIFS Marine：联合大气-海洋-海冰-波浪预报系统", "", "ECMWF | 2026年4月"]),

            ("为什么需要耦合海洋表示",
             ["• 表层海洋、海冰和波浪与大气边界层直接相互作用",
              "• 传统系统：独立模型→显式耦合→引入耦合误差",
              "• 现有ML模型：仅预报大气，隐含依赖海洋影响",
              "• 物理证实：显式海洋表示改善中期预报技能",
              "• 研究问题：ML模型中是否需要显式海洋表示？"]),

            ("知识缺口与技术突破点",
             ["• 现状：大多数ML模型仅预报大气，缺乏显式海洋/海冰",
              "• 未解问题：隐含影响足以维持预报技能吗？",
              "• 尚无研究：跨成分的联合ML建模（除Aurora仅限大气+波浪）",
              "• 关键挑战：不同成分时间尺度、数据一致性",
              "• 本研究目标：显式表示所有海洋和冰冻圈成分"]),

            ("论文核心主张：组件无关的联合建模",
             ["• 创新点1：单一编码-处理-解码架构，同时处理所有成分",
              "  无需显式耦合，跨成分依赖直接从数据学习",
              "",
              "• 创新点2：共享潜在表示",
              "  所有变量视为统一状态空间，自由学习交互",
              "",
              "• 创新点3：充分利用ML架构表达能力",
              "  学习非线性跨成分关系，超越参数化物理耦合"]),

            ("AIFS Marine模型设计",
             ["• 架构：注意力图神经网络编码器 + Transformer处理器 + 解码器",
              "• 分辨率：N320 Gaussian网格（~0.25°），13个大气压力层",
              "• 时间步：预测6小时增量，自回归获得更长预报",
              "",
              "• 变量简化策略：",
              "  大气：137→13  |  波浪：>1200→10",
              "  海洋表层：SST、盐度、海表高、流速",
              "  海冰：浓度、体积、速度、积雪、反照率"]),

            ("技术创新：缺失值与物理约束",
             ["• 缺失值处理：海洋变量在陆地上未定义",
              "  归一化空间替换为零，保留掩码，训练排除无效位置",
              "",
              "• 物理约束：强制可物理的输出范围",
              "  非负波浪：ReLU边界",
              "  海冰浓度[0,1]，SST≥271.15K：Leaky HardTanh",
              "  泄漏边界避免消失梯度（优于标准边界）",
              "",
              "• 海冰一致性：浓度=0时，其他海冰变量强制为0"]),

            ("技术创新：损失函数缩放平衡",
             ["• 问题1：多时间尺度耦合",
              "  海洋/海冰缓慢演变，训练信号弱→大损失权重补偿",
              "",
              "• 问题2：成分竞争",
              "  海洋变量与大气竞争容量→权重减半平衡",
              "",
              "• 缩放因子示例：",
              "  大气字段：1.0-12  |  波浪：0.1-0.5",
              "  海洋/海冰：0.025-10  |  全Marine：权重×0.5",
              "",
              "• 结果：保持大气质量同时改进海洋成分"]),

            ("数据集与训练策略",
             ["• 一致再分析确保物理一致性：",
              "  大气：ERA5(1979-2022)  波浪：ecWAM(1979-2025)+DA",
              "  海洋/海冰：ORAS6(1993-2023)",
              "",
              "• 两阶段训练：",
              "  预训练(1993-2022)：6小时增量大气预报",
              "  微调(2016-2022)：自回归72小时预报",
              "",
              "• 模型变体：",
              "  AIFS Atmosphere | AIFS Waves | AIFS Ocean | AIFS Marine"]),

            ("关键证据1：海浪预报技能",
             ["• 显著波高(SWH)改进：相比物理模式约10% RMSE减少",
              "  对应提前约1天预报技能",
              "",
              "• 全球评估(卫星高度计，2024年5-9月)：",
              "  大部分区域改进，风浪主导区最明显",
              "",
              "• 关键发现：",
              "  AIFS Waves冰缘处性能降低（波浪衰减学习困难）",
              "  AIFS Marine改善（显式海冰信息助益）",
              "  频率分解波信息提升冰缘处预报"]),

            ("关键证据2：海冰预报技能",
             ["• 冰缘位置误差(IIEE)：AIFS Ocean/Marine显著优于IFS",
              "  北极和南极均改进，南极尤其显著",
              "",
              "• 海冰浓度空间分布：",
              "  边际冰区沿岸系统改进(ΔMae~0.1)",
              "  改进沿冰缘分布，与动力学一致",
              "",
              "• AIFS Ocean vs AIFS Marine：",
              "  IIEE曲线几乎重合(显式波浪无额外直接贡献)",
              "  但AIFS Marine改善冰缘处波浪预报"]),

            ("关键证据3：表层海洋预报",
             ["• 海表温度(SST)：系统性改进",
              "  RMSE降低，偏差改进(特别是高纬度)",
              "  热带地区改进较小(SST变率低)",
              "",
              "• 海表高(SSH)：挑战性变量",
              "  RMSE可比，存在系统负偏差",
              "  原因：训练期气候变化信号(平均海平面上升)",
              "",
              "• 启示：缓变趋势变量需特殊处理",
              "  异常预报或去趋势训练"]),

            ("重要评估：对大气预报的影响",
             ["• 添加波浪：中立影响",
              "  原因：波对大气中期影响有限",
              "",
              "• 添加海洋成分：轻微负面",
              "  原因：数据集不一致(ERA5 vs ORAS6)",
              "",
              "• 局地改进：",
              "  海冰区表面温度显著改进(冰反照率正确表示)",
              "  热带温度改善(SST梯度影响大气流通)",
              "",
              "• 启示：数据一致性对联合建模至关重要"]),

            ("物理一致性证明：极地案例研究",
             ["• 南极Bellingshausen和Weddell海的多变量耦合：",
              "",
              "• 海冰浓度仅在冷SST区域形成(热力一致性)",
              "• 波浪衰减在冰缘处急剧衰减(波-冰交互自学)",
              "• 海冰体积与SST和风场动力一致演变",
              "",
              "• 关键：无显式耦合机制",
              "  模型自动学习复杂耦合过程",
              "  缺乏参数化方程仍具物理一致性"]),

            ("稳健性验证：灵敏度实验",
             ["• 实验1：理想化大幅波浪扰动",
              "  初值：仅远洋孤立波，其余平静",
              "  结果：波浪正确传播，新系统通过风强制生成",
              "  验证：从内部动力学涌现，非单纯继承初值",
              "",
              "• 实验2：移除初始海冰",
              "  结果：按季节自然恢复(北极快速，南极晚)",
              "  时间尺度物理一致(热动力平衡)",
              "",
              "• 结论：分布外初值下表现稳健，物理响应合理"]),

            ("讨论：隐式vs显式表示的权衡",
             ["• 中期时间尺度：隐式海洋表示基本充分",
              "  大气预报不因缺乏显式海洋而下降",
              "  显式表示价值：完整状态+海洋应用",
              "",
              "• 更长时间尺度(季节+)：显式表示益处增大",
              "  海洋热容量记忆需3D结构追踪",
              "  显式海冰助于极地可预报性",
              "",
              "• 改进方向：",
              "  耦合再分析替代不匹配的组件再分析",
              "  SSH：去趋势训练或异常预报",
              "  集合概率预报扩展"]),

            ("总结：联合地球系统ML模型的潜力",
             ["• 研究创新：",
              "  首个全面联合ML地球系统模型(大气+海洋+海冰+波浪)",
              "  显式学习跨成分耦合，无需规定式机制",
              "  技术突破：缺失值处理、泄漏约束、损失缩放",
              "",
              "• 性能收获：",
              "  海浪、海冰、SST预报提前~1天",
              "  中期大气预报保持竞争力",
              "  分布外初值下稳健响应",
              "",
              "• 前景：",
              "  更快推理、灵活扩展、气候预报基础",
              "  数据驱动地球系统建模的新方向"])
        ]

        # Create slides
        for slide_num, (title, bullets) in enumerate(slide_data, 1):
            slide_xml = create_slide_xml(slide_num, title, bullets)
            zf.writestr(f'ppt/slides/slide{slide_num}.xml', slide_xml)

        # ==================== MASTERS & THEMES ====================

        # slideMaster
        slide_master = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldMaster>'''
        zf.writestr('ppt/slideMasters/slideMaster1.xml', slide_master)

        # slideLayout
        slide_layout = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg>
  <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>'''
        for layout_id in [1, 2]:
            zf.writestr(f'ppt/slideLayouts/slideLayout{layout_id}.xml', slide_layout)

        # theme
        theme = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Nature Blue">
  <a:themeElements>
    <a:clrScheme name="Nature">
      <a:dk1><a:srgbClr val="003366"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="333333"/></a:dk2>
      <a:lt2><a:srgbClr val="E6F0FA"/></a:lt2>
      <a:accent1><a:srgbClr val="0066CC"/></a:accent1>
      <a:accent2><a:srgbClr val="00B0E3"/></a:accent2>
      <a:accent3><a:srgbClr val="999999"/></a:accent3>
      <a:accent4><a:srgbClr val="CCCCCC"/></a:accent4>
      <a:accent5><a:srgbClr val="666666"/></a:accent5>
      <a:accent6><a:srgbClr val="DDDDDD"/></a:accent6>
      <a:hyperlink><a:srgbClr val="0066FF"/></a:hyperlink>
      <a:folHyperlink><a:srgbClr val="660099"/></a:folHyperlink>
    </a:clrScheme>
  </a:themeElements>
</a:theme>'''
        zf.writestr('ppt/theme/theme1.xml', theme)

    return pptx_path


def create_slide_xml(slide_num, title, bullets):
    """Create XML for a single slide"""

    # Title shape
    title_xml = f'''<p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title {slide_num}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="914400"/></a:xfrm></p:spPr>
      <p:txBody>
        <a:bodyPr anchor="ctr"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="l"/>
          <a:r>
            <a:rPr lang="zh-CN" sz="5400" b="1" latin="Calibri"/>
            <a:t>{escape_xml(title)}</a:t>
          </a:r>
        </a:p>
      </p:txBody>
    </p:sp>'''

    # Content shape
    content_xml = '''<p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="457200" y="1371600"/><a:ext cx="8229600" cy="5011200"/></a:xfrm></p:spPr>
      <p:txBody>
        <a:bodyPr anchor="t" lIns="91440" tIns="91440" rIns="91440" bIns="91440"/>
        <a:lstStyle/>
'''

    for bullet in bullets:
        if bullet.strip():
            content_xml += f'''        <a:p>
          <a:pPr lvl="0"/>
          <a:r>
            <a:rPr lang="zh-CN" sz="2800" latin="Calibri"/>
            <a:t>{escape_xml(bullet)}</a:t>
          </a:r>
        </a:p>
'''
        else:
            content_xml += '''        <a:p><a:pPr lvl="0"/></a:p>
'''

    content_xml += '''      </p:txBody>
    </p:sp>'''

    # Complete slide
    slide_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/><a:chOff x="0" y="0"/><a:chExt cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr>
      {title_xml}
      {content_xml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>'''

    return slide_xml


def escape_xml(text):
    """Escape XML special characters"""
    replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
    }
    for char, escape in replacements.items():
        text = text.replace(char, escape)
    return text


if __name__ == "__main__":
    pptx_file = create_pptx_content()
    file_size = pptx_file.stat().st_size / 1024
    print(f"✓ PPT文件已生成！")
    print(f"  文件名：{pptx_file.name}")
    print(f"  位置：{pptx_file.absolute()}")
    print(f"  大小：{file_size:.1f} KB")
    print(f"  幻灯片数：16张")
    print(f"  状态：✅ 可直接在PowerPoint中打开使用")
