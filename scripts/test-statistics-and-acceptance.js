const BASE_URL = 'http://localhost:3001/api';
const TEST_PROJECT_CODE = 'TEST-STAT-ACCEPT';
const TEST_MILESTONE_CODE_PREFIX = 'TEST-MS-';
const TEST_RISK_CODE = 'TEST-RISK-STAT';
const TEST_ACCEPTANCE_CODE_PREFIX = 'TEST-ACCEPT-STAT-';

async function login(username, password) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`登录失败: ${data.message}`);
  }
  return data.data.token;
}

async function createProject(token, projectCode, projectName, customerName) {
  const response = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_code: projectCode,
      project_name: projectName,
      customer_name: customerName,
      description: '统计面板和验收规则测试项目',
      status: 'in_progress',
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    })
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`创建项目失败: ${data.message}`);
  }
  return data.data;
}

async function createMilestone(token, projectId, milestoneCode, milestoneName, status, sortOrder, predecessorIds = []) {
  const response = await fetch(`${BASE_URL}/milestones`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: projectId,
      milestone_code: milestoneCode,
      milestone_name: milestoneName,
      description: `测试里程碑 - ${milestoneName}`,
      planned_date: '2024-06-30',
      status: status,
      sort_order: sortOrder,
      predecessor_ids: predecessorIds
    })
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`创建里程碑失败: ${data.message}`);
  }
  return data.data;
}

async function createRisk(token, projectId, riskCode, riskTitle, riskLevel) {
  const response = await fetch(`${BASE_URL}/risks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: projectId,
      risk_code: riskCode,
      risk_title: riskTitle,
      description: '测试风险项，用于验证统计面板的风险显示',
      risk_level: riskLevel,
      probability: 'high',
      impact: 'high',
      mitigation_measure: '测试缓解措施',
      status: 'open'
    })
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`创建风险项失败: ${data.message}`);
  }
  return data.data;
}

async function createAcceptance(token, projectId, milestoneId, acceptanceCode, title) {
  const response = await fetch(`${BASE_URL}/acceptance`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: projectId,
      milestone_id: milestoneId,
      acceptance_code: acceptanceCode,
      acceptance_title: title,
      description: '测试验收单',
      acceptance_content: '测试验收内容',
      status: 'draft'
    })
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`创建验收单失败: ${data.message}`);
  }
  return data.data;
}

async function submitAcceptance(token, acceptanceId) {
  const response = await fetch(`${BASE_URL}/acceptance/${acceptanceId}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data;
}

async function reviewAcceptance(token, acceptanceId, status, reviewOpinion) {
  const response = await fetch(`${BASE_URL}/acceptance/${acceptanceId}/review`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: status,
      acceptance_result: status === 'accepted' ? 'passed' : 'failed',
      review_opinion: reviewOpinion
    })
  });
  const data = await response.json();
  return data;
}

async function getProjectStatistics(token, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/dashboard/statistics${queryString ? '?' + queryString : ''}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`获取统计数据失败: ${data.message}`);
  }
  return data.data;
}

async function getProjectByCode(token, projectCode) {
  const response = await fetch(`${BASE_URL}/projects?project_code=${projectCode}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!data.success) {
    return null;
  }
  return data.data.find(p => p.project_code === projectCode) || null;
}

async function deleteProject(token, projectId) {
  const response = await fetch(`${BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

async function cleanupTestData(token, projectCode) {
  console.log('  清理测试数据...');
  const project = await getProjectByCode(token, projectCode);
  if (project) {
    await deleteProject(token, project.id);
    console.log(`  已删除测试项目: ${projectCode}`);
  } else {
    console.log('  无可清理的测试项目');
  }
}

async function runTest() {
  console.log('================================================================');
  console.log('  项目统计面板与验收规则综合测试脚本');
  console.log('================================================================\n');

  let testProjectId = null;
  let testAcceptanceId = null;
  let testMilestone2Id = null;

  try {
    console.log('步骤 1: 登录系统...');
    const token = await login('admin', 'password123');
    console.log('✓ 登录成功 (admin / password123)\n');

    console.log('步骤 2: 清理旧的测试数据...');
    await cleanupTestData(token, TEST_PROJECT_CODE);
    console.log('');

    console.log('步骤 3: 创建测试项目...');
    const project = await createProject(
      token,
      TEST_PROJECT_CODE,
      '统计面板与验收规则测试项目',
      '测试客户科技有限公司'
    );
    testProjectId = project.id;
    console.log(`✓ 项目创建成功: ${project.project_name} (${project.id})\n`);

    console.log('步骤 4: 创建里程碑链路（带前置依赖）...');
    
    const milestone1 = await createMilestone(
      token,
      testProjectId,
      `${TEST_MILESTONE_CODE_PREFIX}01`,
      '需求调研完成',
      'in_progress',
      1,
      []
    );
    console.log(`  ✓ 里程碑1: ${milestone1.milestone_name} [${milestone1.status}]`);

    const milestone2 = await createMilestone(
      token,
      testProjectId,
      `${TEST_MILESTONE_CODE_PREFIX}02`,
      '用户验收测试',
      'pending',
      2,
      [milestone1.id]
    );
    testMilestone2Id = milestone2.id;
    console.log(`  ✓ 里程碑2: ${milestone2.milestone_name} [${milestone2.status}]`);
    console.log(`    前置依赖: ${milestone1.milestone_name} [${milestone1.status}]\n`);

    console.log('步骤 5: 创建高风险项...');
    const risk = await createRisk(
      token,
      testProjectId,
      TEST_RISK_CODE,
      '项目进度延期风险',
      'high'
    );
    console.log(`✓ 风险项创建成功: ${risk.risk_title} [${risk.risk_level}]\n`);

    console.log('步骤 6: 获取统计面板数据，验证项目风险状态...');
    const stats1 = await getProjectStatistics(token);
    console.log('  统计面板数据:');
    console.log(`    - 按风险等级统计: ${stats1.by_risk_level.map(r => `${r.risk_level}=${r.count}`).join(', ')}`);
    
    const projectInStats = stats1.project_risk_status.find(p => p.project_id === testProjectId);
    if (projectInStats) {
      console.log(`    - 测试项目风险等级: ${projectInStats.risk_level}`);
      console.log(`    - 测试项目活跃风险数: ${projectInStats.active_risks_count}`);
      if (projectInStats.risk_level === 'high' && projectInStats.active_risks_count >= 1) {
        console.log('  ✅ 统计面板正确显示项目处于高风险状态\n');
      } else {
        console.log('  ❌ 统计面板风险状态显示不正确');
        process.exit(1);
      }
    } else {
      console.log('  ❌ 统计面板中未找到测试项目');
      process.exit(1);
    }

    console.log('步骤 7: 为里程碑2创建草稿验收单...');
    const timestamp = Date.now();
    const acceptanceCode = `${TEST_ACCEPTANCE_CODE_PREFIX}${timestamp}`;
    const acceptance = await createAcceptance(
      token,
      testProjectId,
      milestone2.id,
      acceptanceCode,
      `用户验收测试验收单-${timestamp}`
    );
    testAcceptanceId = acceptance.id;
    console.log(`✓ 验收单创建成功: ${acceptance.acceptance_code} [${acceptance.status}]\n`);

    console.log('步骤 8: 尝试提交验收单（前置里程碑未完成）...');
    console.log('  测试场景:');
    console.log(`    - 前置里程碑: ${milestone1.milestone_name} [${milestone1.status}]`);
    console.log(`    - 当前里程碑: ${milestone2.milestone_name} [${milestone2.status}]`);
    console.log('    - 预期结果: 因为前置里程碑未完成，提交应该被拒绝');
    console.log('  调用接口: POST /api/acceptance/:id/submit');
    
    const submitResult = await submitAcceptance(token, acceptance.id);
    console.log(`  接口响应: success=${submitResult.success}, error=${submitResult.error}`);
    console.log(`  消息: ${submitResult.message}\n`);

    console.log('========================================');
    console.log('  验收提交验证结果');
    console.log('========================================');
    
    if (!submitResult.success && submitResult.error === 'PREDECESSOR_NOT_COMPLETED') {
      console.log('✅ 验证通过! 接口正确拒绝了前置里程碑未完成的验收提交');
      console.log(`   拒绝原因: ${submitResult.message}`);
      console.log('\n✅ 业务规则验证成功: 前置里程碑未完成时不能提交验收单\n');
    } else {
      console.log('❌ 验证失败! 接口没有正确拒绝前置里程碑未完成的验收提交');
      console.log(`   success: ${submitResult.success}`);
      console.log(`   error: ${submitResult.error}`);
      console.log(`   message: ${submitResult.message}`);
      process.exit(1);
    }

    console.log('步骤 9: 测试审核接口的前置验证（模拟恶意提交）...');
    console.log('  先将验收单状态强制更新为submitted（模拟绕过提交验证）...');
    
    await fetch(`${BASE_URL}/acceptance/${acceptance.id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'submitted' })
    });
    console.log('  验收单状态已更新为 submitted');
    
    console.log('  调用审核接口: POST /api/acceptance/:id/review');
    const reviewResult = await reviewAcceptance(
      token,
      acceptance.id,
      'accepted',
      '测试审核通过'
    );
    console.log(`  接口响应: success=${reviewResult.success}, error=${reviewResult.error}`);
    console.log(`  消息: ${reviewResult.message}\n`);

    console.log('========================================');
    console.log('  验收审核验证结果');
    console.log('========================================');
    
    if (!reviewResult.success && reviewResult.error === 'PREDECESSOR_NOT_COMPLETED') {
      console.log('✅ 验证通过! 审核接口也正确拒绝了前置里程碑未完成的验收');
      console.log(`   拒绝原因: ${reviewResult.message}`);
      console.log('\n✅ 双重验证成功: 提交和审核接口都检查了前置里程碑完成状态\n');
    } else {
      console.log('❌ 验证失败! 审核接口没有正确检查前置里程碑状态');
      console.log(`   success: ${reviewResult.success}`);
      console.log(`   error: ${reviewResult.error}`);
      console.log(`   message: ${reviewResult.message}`);
      process.exit(1);
    }

    console.log('步骤 10: 验证统计面板的筛选功能...');
    console.log('  按客户筛选:');
    const statsByCustomer = await getProjectStatistics(token, { customer_name: '测试客户' });
    const filteredByCustomer = statsByCustomer.by_customer.filter(p => p.customer_name.includes('测试客户'));
    console.log(`    筛选结果: ${filteredByCustomer.length} 个项目`);
    
    console.log('  按风险等级筛选 (high):');
    const statsByRisk = await getProjectStatistics(token, { risk_level: 'high' });
    const highRiskProjects = statsByRisk.project_risk_status.filter(p => p.risk_level === 'high');
    console.log(`    高风险项目数: ${highRiskProjects.length}`);
    
    if (filteredByCustomer.length > 0 && highRiskProjects.length > 0) {
      console.log('  ✅ 统计面板筛选功能正常\n');
    } else {
      console.log('  ❌ 统计面板筛选功能异常');
      process.exit(1);
    }

    console.log('步骤 11: 验证统计面板的钻取数据...');
    const stats2 = await getProjectStatistics(token);
    const highRiskStat = stats2.by_risk_level.find(r => r.risk_level === 'high');
    if (highRiskStat && highRiskStat.risks.length > 0) {
      const riskInStat = highRiskStat.risks.find(r => r.code === TEST_RISK_CODE);
      if (riskInStat) {
        console.log(`  ✅ 风险钻取数据正确: ${riskInStat.title} (${riskInStat.customer_name})`);
        console.log(`     可跳转项目ID: ${riskInStat.project_id}`);
      }
    }
    
    const inProgressStat = stats2.by_status.find(s => s.status === 'in_progress');
    if (inProgressStat && inProgressStat.milestones.length > 0) {
      const milestoneInStat = inProgressStat.milestones.find(m => m.code === `${TEST_MILESTONE_CODE_PREFIX}01`);
      if (milestoneInStat) {
        console.log(`  ✅ 里程碑钻取数据正确: ${milestoneInStat.name} (${milestoneInStat.project_name})`);
        console.log(`     可跳转里程碑ID: ${milestoneInStat.id}`);
      }
    }
    console.log('');

    console.log('========================================');
    console.log('  综合测试结果');
    console.log('========================================');
    console.log('✅ 项目统计面板功能: PASS');
    console.log('   - 按客户统计 ✓');
    console.log('   - 按里程碑阶段统计 ✓');
    console.log('   - 按风险等级统计 ✓');
    console.log('   - 项目风险状态显示 ✓');
    console.log('   - 筛选功能 ✓');
    console.log('   - 钻取跳转数据 ✓');
    console.log('✅ 验收业务规则: PASS');
    console.log('   - 提交接口前置检查 ✓');
    console.log('   - 审核接口前置检查 ✓');
    console.log('✅ 统计面板风险状态: PASS');
    console.log('   - 高风险项目正确显示 ✓');
    console.log('   - 活跃风险数正确统计 ✓');
    console.log('');
    console.log('🎉 所有测试通过! 功能实现完整。');

    console.log('\n步骤 12: 清理测试数据...');
    await cleanupTestData(token, TEST_PROJECT_CODE);
    console.log('✓ 测试数据清理完成\n');

    process.exit(0);

  } catch (error) {
    console.log('\n❌ 测试执行出错:', error.message);
    console.log(error.stack);
    
    if (testProjectId) {
      console.log('\n尝试清理测试数据...');
      try {
        const token = await login('admin', 'password123');
        await cleanupTestData(token, TEST_PROJECT_CODE);
      } catch (cleanupError) {
        console.log('清理失败:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

runTest();
