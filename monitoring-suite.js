// Complete Monitoring Suite for Bybit Event App
const fetch = require('node-fetch');
const fs = require('fs');
const AnalyticsDashboard = require('./analytics-dashboard');
const BackupSystem = require('./backup-system');

const PRODUCTION_URL = 'https://bybit-event-mini-app-production-ae87.up.railway.app';

class MonitoringSuite {
    constructor() {
        this.analytics = new AnalyticsDashboard();
        this.backup = new BackupSystem();
        this.alerts = [];
        this.thresholds = {
            max_response_time: 5000, // 5 seconds
            min_uptime_percentage: 95,
            max_error_rate: 5 // 5%
        };
    }

    async checkSystemHealth() {
        console.log('🏥 SYSTEM HEALTH CHECK');
        console.log('=====================\n');

        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            checks: {},
            alerts: []
        };

        // 1. API Availability Check
        try {
            const start = Date.now();
            const response = await fetch(`${PRODUCTION_URL}/api/leaderboard`);
            const responseTime = Date.now() - start;

            health.checks.api_availability = {
                status: response.ok ? 'healthy' : 'unhealthy',
                response_time_ms: responseTime,
                status_code: response.status
            };

            if (responseTime > this.thresholds.max_response_time) {
                health.alerts.push(`High response time: ${responseTime}ms`);
            }

            console.log(`✅ API Available (${responseTime}ms)`);
        } catch (error) {
            health.checks.api_availability = {
                status: 'down',
                error: error.message
            };
            health.status = 'unhealthy';
            health.alerts.push('API is down');
            console.log('❌ API Down:', error.message);
        }

        // 2. Database Health (via API)
        try {
            const debugResponse = await fetch(`${PRODUCTION_URL}/api/debug/referrals`);
            const debugData = await debugResponse.json();

            health.checks.database = {
                status: 'healthy',
                total_users: debugData.total_users || 0,
                environment: debugData.environment
            };

            console.log(`✅ Database Healthy (${debugData.total_users} users)`);
        } catch (error) {
            health.checks.database = {
                status: 'unhealthy',
                error: error.message
            };
            health.alerts.push('Database issues detected');
            console.log('❌ Database Issues:', error.message);
        }

        // 3. Growth Rate Check
        await this.analytics.fetchAllData();
        const growthReport = this.analytics.generateGrowthAnalytics();
        
        health.checks.growth = {
            total_users: growthReport.metrics.total_users || 0,
            daily_average: growthReport.metrics.projections?.daily_average_signups || 0
        };

        // 4. Quest System Check
        try {
            // Check if quest endpoints work
            const questCheck = await fetch(`${PRODUCTION_URL}/api/admin/quests`);
            health.checks.quest_system = {
                status: questCheck.ok ? 'healthy' : 'limited',
                admin_access: questCheck.ok
            };
            console.log(`✅ Quest System ${questCheck.ok ? 'Fully' : 'Partially'} Operational`);
        } catch (error) {
            health.checks.quest_system = {
                status: 'unknown',
                error: error.message
            };
        }

        // Save health report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.writeFileSync(`health-report-${timestamp}.json`, JSON.stringify(health, null, 2));

        console.log(`\n📊 Overall Status: ${health.status.toUpperCase()}`);
        if (health.alerts.length > 0) {
            console.log('🚨 Alerts:');
            health.alerts.forEach(alert => console.log(`   - ${alert}`));
        }

        return health;
    }

    async performanceMonitor(duration = 60000) { // 1 minute default
        console.log(`⚡ PERFORMANCE MONITORING (${duration/1000}s)`);
        console.log('=====================================\n');

        const results = {
            start_time: new Date().toISOString(),
            duration_ms: duration,
            requests: [],
            summary: {}
        };

        const startTime = Date.now();
        let requestCount = 0;

        const testEndpoints = [
            '/api/leaderboard',
            '/api/debug/referrals'
        ];

        while (Date.now() - startTime < duration) {
            for (const endpoint of testEndpoints) {
                try {
                    const requestStart = Date.now();
                    const response = await fetch(`${PRODUCTION_URL}${endpoint}`);
                    const responseTime = Date.now() - requestStart;

                    results.requests.push({
                        endpoint,
                        response_time: responseTime,
                        status: response.status,
                        timestamp: new Date().toISOString()
                    });

                    requestCount++;
                    process.stdout.write(`\r📊 Requests: ${requestCount} | Avg: ${this.calculateAverageResponseTime(results.requests)}ms`);

                } catch (error) {
                    results.requests.push({
                        endpoint,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Wait 5 seconds between test cycles
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Calculate summary
        const responseTimes = results.requests
            .filter(r => r.response_time)
            .map(r => r.response_time);

        results.summary = {
            total_requests: results.requests.length,
            successful_requests: results.requests.filter(r => r.status === 200).length,
            failed_requests: results.requests.filter(r => r.error).length,
            average_response_time: this.calculateAverageResponseTime(results.requests),
            min_response_time: Math.min(...responseTimes),
            max_response_time: Math.max(...responseTimes),
            uptime_percentage: ((results.requests.filter(r => r.status === 200).length / results.requests.length) * 100).toFixed(2)
        };

        console.log('\n\n📈 PERFORMANCE SUMMARY');
        console.log('=====================');
        Object.entries(results.summary).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
        });

        // Save performance report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.writeFileSync(`performance-report-${timestamp}.json`, JSON.stringify(results, null, 2));
        console.log(`\n📁 Report saved: performance-report-${timestamp}.json`);

        return results;
    }

    calculateAverageResponseTime(requests) {
        const responseTimes = requests
            .filter(r => r.response_time)
            .map(r => r.response_time);
        
        return responseTimes.length > 0 
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;
    }

    async userActivityMonitor() {
        console.log('👥 USER ACTIVITY MONITORING');
        console.log('==========================\n');

        const activity = {
            timestamp: new Date().toISOString(),
            monitoring_period: '24h',
            metrics: {}
        };

        try {
            // Get current user data
            const debugResponse = await fetch(`${PRODUCTION_URL}/api/debug/referrals`);
            const debugData = await debugResponse.json();

            const users = debugData.all_users || [];
            
            activity.metrics.total_users = users.length;
            activity.metrics.total_points = users.reduce((sum, user) => sum + (user.points || 0), 0);

            // Analyze registration patterns
            const today = new Date().toISOString().split('T')[0];
            const todayUsers = users.filter(user => 
                user.created_at && user.created_at.startsWith(today)
            );

            activity.metrics.new_users_today = todayUsers.length;
            activity.metrics.growth_rate = users.length > 0 ? 
                ((todayUsers.length / users.length) * 100).toFixed(2) + '%' : '0%';

            // User segmentation
            activity.metrics.user_segments = {
                new_users: users.filter(u => u.points < 50).length,
                active_users: users.filter(u => u.points >= 50 && u.points < 200).length,
                power_users: users.filter(u => u.points >= 200).length
            };

            console.log('📊 Current Metrics:');
            Object.entries(activity.metrics).forEach(([key, value]) => {
                if (typeof value === 'object') {
                    console.log(`${key}:`);
                    Object.entries(value).forEach(([subKey, subValue]) => {
                        console.log(`  ${subKey}: ${subValue}`);
                    });
                } else {
                    console.log(`${key}: ${value}`);
                }
            });

            // Save activity report
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.writeFileSync(`activity-report-${timestamp}.json`, JSON.stringify(activity, null, 2));
            console.log(`\n📁 Activity report saved: activity-report-${timestamp}.json`);

        } catch (error) {
            console.error('❌ Activity monitoring failed:', error.message);
            activity.error = error.message;
        }

        return activity;
    }

    async generateDailyReport() {
        console.log('📋 GENERATING DAILY REPORT');
        console.log('=========================\n');

        const report = {
            date: new Date().toISOString().split('T')[0],
            generated_at: new Date().toISOString(),
            sections: {}
        };

        try {
            // 1. System Health
            console.log('1. Running health check...');
            report.sections.health = await this.checkSystemHealth();

            // 2. User Activity
            console.log('\n2. Analyzing user activity...');
            report.sections.activity = await this.userActivityMonitor();

            // 3. Analytics
            console.log('\n3. Generating analytics...');
            await this.analytics.fetchAllData();
            this.analytics.generateUserAnalytics();
            this.analytics.generateGrowthAnalytics();
            this.analytics.generateReferralAnalytics();
            report.sections.analytics = this.analytics.reports;

            // 4. Create Backup
            console.log('\n4. Creating backup...');
            const backupResult = await this.backup.createFullBackup();
            report.sections.backup = {
                status: backupResult.success ? 'completed' : 'failed',
                details: backupResult
            };

            // 5. Generate Summary
            const summary = this.generateSummary(report);
            report.summary = summary;

            // Save daily report
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `daily-report-${timestamp}.json`;
            fs.writeFileSync(fileName, JSON.stringify(report, null, 2));

            console.log('\n✅ DAILY REPORT COMPLETED');
            console.log('========================');
            console.log('📊 Summary:');
            Object.entries(summary).forEach(([key, value]) => {
                console.log(`${key}: ${value}`);
            });
            console.log(`\n📁 Full report: ${fileName}`);

        } catch (error) {
            console.error('❌ Daily report generation failed:', error.message);
            report.error = error.message;
        }

        return report;
    }

    generateSummary(report) {
        const summary = {
            overall_status: 'healthy',
            total_users: 0,
            total_points: 0,
            new_users_today: 0,
            backup_status: 'unknown',
            alerts: []
        };

        try {
            // Extract key metrics
            if (report.sections.health) {
                summary.overall_status = report.sections.health.status;
                summary.alerts = report.sections.health.alerts || [];
            }

            if (report.sections.activity?.metrics) {
                summary.total_users = report.sections.activity.metrics.total_users || 0;
                summary.total_points = report.sections.activity.metrics.total_points || 0;
                summary.new_users_today = report.sections.activity.metrics.new_users_today || 0;
            }

            if (report.sections.backup) {
                summary.backup_status = report.sections.backup.status;
            }

        } catch (error) {
            summary.error = 'Failed to generate summary';
        }

        return summary;
    }

    async startContinuousMonitoring(intervalMinutes = 60) {
        console.log(`🔄 STARTING CONTINUOUS MONITORING`);
        console.log(`⏰ Interval: Every ${intervalMinutes} minutes`);
        console.log('⚠️  Keep this process running for continuous monitoring\n');

        // Initial run
        await this.checkSystemHealth();

        // Schedule recurring checks
        const intervalMs = intervalMinutes * 60 * 1000;
        setInterval(async () => {
            console.log(`\n⏰ Scheduled health check...`);
            const health = await this.checkSystemHealth();
            
            if (health.status !== 'healthy') {
                console.log('🚨 ALERT: System health issues detected!');
                // Here you could add email/SMS notifications
            }
        }, intervalMs);

        console.log(`✅ Continuous monitoring active.`);
    }
}

// CLI Interface
async function main() {
    const monitor = new MonitoringSuite();
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'health':
            await monitor.checkSystemHealth();
            break;
            
        case 'performance':
            const duration = parseInt(args[1]) * 1000 || 60000; // seconds to ms
            await monitor.performanceMonitor(duration);
            break;
            
        case 'activity':
            await monitor.userActivityMonitor();
            break;
            
        case 'daily':
            await monitor.generateDailyReport();
            break;
            
        case 'continuous':
            const interval = parseInt(args[1]) || 60; // minutes
            await monitor.startContinuousMonitoring(interval);
            break;
            
        default:
            console.log('🔍 MONITORING SUITE COMMANDS');
            console.log('===========================\n');
            console.log('node monitoring-suite.js health           - System health check');
            console.log('node monitoring-suite.js performance [sec] - Performance test');
            console.log('node monitoring-suite.js activity         - User activity analysis');
            console.log('node monitoring-suite.js daily           - Generate daily report');
            console.log('node monitoring-suite.js continuous [min] - Start continuous monitoring');
            console.log('\nExamples:');
            console.log('node monitoring-suite.js performance 120  (2 minute test)');
            console.log('node monitoring-suite.js continuous 30    (check every 30 min)');
            break;
    }
}

module.exports = MonitoringSuite;

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}