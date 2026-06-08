const BASE_URL = 'http://localhost:3001/api';
const TEST_ACCEPTANCE_CODE_PREFIX = 'TEST-ACCEPT-';

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

async function getProject(token, projectCode) {
  const response = await fetch(`${BASE_URL}/projects?project_code=${projectCode}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`获取项目失败: ${data.message}`);
  }
  return data.data.find(p => p.project_code === projectCode);
}

async function getMilestones(token, projectId) {
  const response = await fetch(`${BASE_URL}/milestones?project_id=${projectId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`获取里程碑失败: ${data.message}`);
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

async function getAcceptanceByCode(token, acceptanceCode) {
  const response = await fetch(`${BASE_URL}/acceptance?acceptance_code=${acceptanceCode}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!data.success) {
    return null;
  }
  return data.data.find(a => a.acceptance_code === acceptanceCode) || null;
}

async function deleteAcceptance(token, acceptanceId) {
  const response = await fetch(`${BASE_URL}/acceptance/${acceptanceId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data;
}

async function cleanupTestAcceptances(token, projectId) {
  console.log('  清理旧的测试验收单...');
  const response = await fetch(`${BASE_URL}/acceptance?project_id=${projectId}&status=draft`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  if (!data.success || !data.data) {
    console.log('  无可清理的验收单');
    return;
  }
  const testAcceptances = data.data.filter(a => 
    a.acceptance_code && a.acceptance_code.startsWith(TEST_ACCEPTANCE_CODE_PREFIX)
  );
  for (const acceptance of testAcceptances) {
    await deleteAcceptance(token, acceptance.id);
    console.log(`  已删除: ${acceptance.acceptance_code}`);
  }
  console.log(`  清理完成，共删除 ${testAcceptances.length} 个测试验收单\n`);
}

async function runTest() {
  console.log('========================================');
  console.log('  前置里程碑验收规则验证脚本');
  console.log('========================================\n');

  let testAcceptanceId = null;

  try {
    console.log('步骤 1: 登录系统...');
    const token = await login('admin', 'password123');
    console.log('✓ 登录成功\n');

    console.log('步骤 2: 获取测试项目 PROJ001...');
    const project = await getProject(token, 'PROJ001');
    if (!project) {
      throw new Error('未找到项目 PROJ001');
    }
    console.log(`✓ 找到项目: ${project.project_name} (${project.id})\n`);

    console.log('步骤 3: 清理旧的测试验收单...');
    await cleanupTestAcceptances(token, project.id);

    console.log('步骤 4: 获取项目里程碑列表...');
    const milestones = await getMilestones(token, project.id);
    console.log('✓ 获取里程碑列表:');
    milestones.forEach(m => {
      console.log(`  - ${m.milestone_code}: ${m.milestone_name} [${m.status}]`);
    });
    console.log('');

    const milestoneInProgress = milestones.find(m => m.milestone_code === 'MS003');
    const milestonePending = milestones.find(m => m.milestone_code === 'MS004');

    if (!milestoneInProgress || !milestonePending) {
      throw new Error('未找到测试里程碑');
    }

    console.log(`测试场景:`);
    console.log(`  - 前置里程碑 MS003: ${milestoneInProgress.milestone_name} [${milestoneInProgress.status}]`);
    console.log(`  - 当前里程碑 MS004: ${milestonePending.milestone_name} [${milestonePending.status}]`);
    console.log(`  - 预期结果: 因为 MS003 未完成，提交 MS004 的验收单应该被拒绝\n`);

    const timestamp = Date.now();
    const uniqueAcceptanceCode = `${TEST_ACCEPTANCE_CODE_PREFIX}${timestamp}`;
    console.log(`步骤 5: 为 MS004 创建草稿验收单 (编码: ${uniqueAcceptanceCode})...`);
    const acceptance = await createAcceptance(
      token,
      project.id,
      milestonePending.id,
      uniqueAcceptanceCode,
      `测试-用户验收测试验收单-${timestamp}`
    );
    testAcceptanceId = acceptance.id;
    console.log(`✓ 验收单创建成功: ${acceptance.acceptance_code} [${acceptance.status}]\n`);

    console.log('步骤 6: 尝试提交验收单（跳过前置里程碑验证）...');
    console.log('  调用接口: POST /api/acceptance/:id/submit');
    const result = await submitAcceptance(token, acceptance.id);
    console.log(`  接口响应: ${JSON.stringify(result, null, 2)}\n`);

    console.log('========================================');
    console.log('  验证结果');
    console.log('========================================');
    
    if (!result.success && result.error === 'PREDECESSOR_NOT_COMPLETED') {
      console.log('✅ 验证通过! 接口正确拒绝了跳过前置里程碑的验收提交');
      console.log(`   拒绝原因: ${result.message}`);
      if (result.data && result.data.invalidMilestones) {
        console.log('   未完成的前置里程碑:');
        result.data.invalidMilestones.forEach(m => {
          console.log(`     - ${m.name} [${m.status}]`);
        });
      }
      console.log('\n✅ 业务规则验证成功: 前置里程碑未完成时不能提交验收单');
      
      console.log('\n步骤 7: 清理测试验收单...');
      if (testAcceptanceId) {
        await deleteAcceptance(token, testAcceptanceId);
        console.log('✓ 测试验收单已清理');
      }
      
      process.exit(0);
    } else {
      console.log('❌ 验证失败! 接口没有正确拒绝跳过前置里程碑的验收提交');
      console.log(`   success: ${result.success}`);
      console.log(`   error: ${result.error}`);
      console.log(`   message: ${result.message}`);
      process.exit(1);
    }

  } catch (error) {
    console.log('\n❌ 测试执行出错:', error.message);
    process.exit(1);
  }
}

runTest();
