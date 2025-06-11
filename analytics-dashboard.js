// Analytics Dashboard for Bybit Event App
const fetch = require('node-fetch');
const fs = require('fs');

const PRODUCTION_URL = 'https://bybit-event-mini-app-production-ae87.up.railway.app';
const ADMIN_KEY = 'admin123'; // Change this after deployment

class AnalyticsDashboard {
    constructor() {
        this.data = {};
        this.reports = [];
    }

    async fetchAllData() {
        console.log('📊 ANALYTICS DASHBOARD - DATA COLLECTION');
        console.log('========================================\n');

        try {
            // Fetch from debug endpoint (works now)
            const debugResponse = await fetch(`${PRODUCTION_URL}/api/debug/referrals`);
            this.data.debug = await debugResponse.json();

            // Fetch leaderboard
            const leaderboardResponse = await fetch(`${PRODUCTION_URL}/api/leaderboard`);
            this.data.leaderboard = await leaderboardResponse.json();

            // Try new admin endpoints (after deployment)
            try {
                const usersResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/users?key=${ADMIN_KEY}`);
                if (usersResponse.ok) {
                    this.data.users = await usersResponse.json();
                }

                const questsResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/quests?key=${ADMIN_KEY}`);
                if (questsResponse.ok) {
                    this.data.quests = await questsResponse.json();
                }

                const transactionsResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/transactions?key=${ADMIN_KEY}`);
                if (transactionsResponse.ok) {
                    this.data.transactions = await transactionsResponse.json();
                }
            } catch (adminError) {
                console.log('ℹ️  Admin endpoints not yet available (deploy first)');
            }

            console.log('✅ Data collection completed\n');
            return this.data;

        } catch (error) {
            console.error('❌ Error fetching data:', error.message);
            return null;
        }
    }

    generateUserAnalytics() {
        const users = this.data.debug?.all_users || [];
        const report = {
            title: '👥 User Analytics',
            timestamp: new Date().toISOString(),
            metrics: {}
        };

        if (users.length === 0) {
            report.metrics = { message: 'No users found' };
            return report;
        }

        // Basic metrics
        report.metrics.total_users = users.length;
        report.metrics.total_points = users.reduce((sum, user) => sum + (user.points || 0), 0);
        report.metrics.average_points = Math.round(report.metrics.total_points / users.length);

        // User segmentation
        const pointRanges = {
            beginners: users.filter(u => u.points < 50).length,
            active: users.filter(u => u.points >= 50 && u.points < 200).length,
            power_users: users.filter(u => u.points >= 200).length
        };
        report.metrics.user_segments = pointRanges;

        // Registration timeline
        const usersByDate = {};
        users.forEach(user => {
            const date = user.created_at?.split(' ')[0] || 'unknown';
            usersByDate[date] = (usersByDate[date] || 0) + 1;
        });
        report.metrics.registrations_by_date = usersByDate;

        // Top users
        report.metrics.top_users = users
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 5)
            .map(user => ({
                name: user.first_name,
                username: user.username,
                points: user.points
            }));

        this.reports.push(report);
        return report;
    }

    generateEngagementAnalytics() {
        const report = {
            title: '📈 Engagement Analytics',
            timestamp: new Date().toISOString(),
            metrics: {}
        };

        // If we have transaction data
        if (this.data.transactions?.transactions) {
            const transactions = this.data.transactions.transactions;
            
            report.metrics.total_transactions = transactions.length;
            
            // Transaction types
            const reasonCounts = {};
            transactions.forEach(tx => {
                reasonCounts[tx.reason] = (reasonCounts[tx.reason] || 0) + 1;
            });
            report.metrics.transaction_types = reasonCounts;

            // Daily activity
            const dailyActivity = {};
            transactions.forEach(tx => {
                const date = tx.timestamp?.split(' ')[0] || 'unknown';
                dailyActivity[date] = (dailyActivity[date] || 0) + 1;
            });
            report.metrics.daily_activity = dailyActivity;

        } else {
            report.metrics.message = 'Deploy admin endpoints for detailed engagement analytics';
        }

        this.reports.push(report);
        return report;
    }

    generateQuestAnalytics() {
        const report = {
            title: '🎯 Quest Analytics',
            timestamp: new Date().toISOString(),
            metrics: {}
        };

        if (this.data.quests?.quest_completion_stats) {
            const quests = this.data.quests.quest_completion_stats;
            
            report.metrics.total_quests = quests.length;
            report.metrics.total_completions = quests.reduce((sum, q) => sum + q.completion_count, 0);
            
            // Quest performance
            report.metrics.quest_performance = quests.map(quest => ({
                title: quest.title,
                type: quest.type,
                completions: quest.completion_count,
                completion_rate: Math.round((quest.completion_count / this.data.users?.total_users || 1) * 100)
            }));

            // Best performing quests
            report.metrics.top_quests = quests
                .sort((a, b) => b.completion_count - a.completion_count)
                .slice(0, 3);

        } else {
            report.metrics.message = 'Deploy admin endpoints for detailed quest analytics';
        }

        this.reports.push(report);
        return report;
    }

    generateReferralAnalytics() {
        const users = this.data.debug?.all_users || [];
        const report = {
            title: '🔗 Referral Analytics',
            timestamp: new Date().toISOString(),
            metrics: {}
        };

        const usersWithReferrers = users.filter(u => u.referrer_id);
        const usersWithReferrals = users.filter(u => {
            return users.some(other => other.referrer_id === u.telegram_id);
        });

        report.metrics.total_referred_users = usersWithReferrers.length;
        report.metrics.total_referrers = usersWithReferrals.length;
        report.metrics.referral_rate = users.length > 0 ? Math.round((usersWithReferrers.length / users.length) * 100) : 0;

        // Top referrers
        const referrerStats = {};
        users.forEach(user => {
            if (user.referrer_id) {
                referrerStats[user.referrer_id] = (referrerStats[user.referrer_id] || 0) + 1;
            }
        });

        report.metrics.top_referrers = Object.entries(referrerStats)
            .map(([referrerId, count]) => {
                const referrer = users.find(u => u.telegram_id === referrerId);
                return {
                    name: referrer?.first_name || 'Unknown',
                    username: referrer?.username,
                    referral_count: count
                };
            })
            .sort((a, b) => b.referral_count - a.referral_count)
            .slice(0, 3);

        this.reports.push(report);
        return report;
    }

    generateGrowthAnalytics() {
        const users = this.data.debug?.all_users || [];
        const report = {
            title: '📈 Growth Analytics',
            timestamp: new Date().toISOString(),
            metrics: {}
        };

        if (users.length === 0) {
            report.metrics = { message: 'No users for growth analysis' };
            return report;
        }

        // Registration trend
        const registrationsByDate = {};
        users.forEach(user => {
            const date = user.created_at?.split(' ')[0] || 'unknown';
            registrationsByDate[date] = (registrationsByDate[date] || 0) + 1;
        });

        const dates = Object.keys(registrationsByDate).sort();
        let cumulativeUsers = 0;
        const growthTrend = dates.map(date => {
            cumulativeUsers += registrationsByDate[date];
            return {
                date,
                new_users: registrationsByDate[date],
                total_users: cumulativeUsers
            };
        });

        report.metrics.growth_trend = growthTrend;
        report.metrics.growth_rate = dates.length > 1 ? 
            Math.round(((users.length / (dates.length || 1)) - 1) * 100) : 0;

        // Predict next milestone
        const dailyAverage = users.length / (dates.length || 1);
        const daysTo100Users = Math.ceil((100 - users.length) / dailyAverage);
        const daysTo1000Users = Math.ceil((1000 - users.length) / dailyAverage);

        report.metrics.projections = {
            daily_average_signups: Math.round(dailyAverage * 100) / 100,
            days_to_100_users: daysTo100Users > 0 ? daysTo100Users : 'Already achieved!',
            days_to_1000_users: daysTo1000Users > 0 ? daysTo1000Users : 'Already achieved!'
        };

        this.reports.push(report);
        return report;
    }

    displayReports() {
        console.log('📊 ANALYTICS REPORTS');
        console.log('===================\n');

        this.reports.forEach(report => {
            console.log(`${report.title}`);
            console.log('-'.repeat(40));
            
            Object.entries(report.metrics).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    console.log(`${key}:`);
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            console.log(`  ${index + 1}. ${JSON.stringify(item)}`);
                        });
                    } else {
                        Object.entries(value).forEach(([subKey, subValue]) => {
                            console.log(`  ${subKey}: ${subValue}`);
                        });
                    }
                } else {
                    console.log(`${key}: ${value}`);
                }
            });
            console.log('\n');
        });
    }

    saveReports() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `analytics-report-${timestamp}.json`;
        
        const fullReport = {
            generated_at: new Date().toISOString(),
            production_url: PRODUCTION_URL,
            reports: this.reports,
            raw_data: this.data
        };

        fs.writeFileSync(fileName, JSON.stringify(fullReport, null, 2));
        console.log(`📁 Analytics report saved to: ${fileName}`);
        return fileName;
    }

    async runFullAnalysis() {
        console.log('🚀 Starting Full Analytics Analysis...\n');
        
        // Fetch data
        await this.fetchAllData();
        
        // Generate all reports
        this.generateUserAnalytics();
        this.generateEngagementAnalytics();
        this.generateQuestAnalytics();
        this.generateReferralAnalytics();
        this.generateGrowthAnalytics();
        
        // Display results
        this.displayReports();
        
        // Save to file
        return this.saveReports();
    }
}

// Export for use in other scripts
module.exports = AnalyticsDashboard;

// Run if executed directly
if (require.main === module) {
    const dashboard = new AnalyticsDashboard();
    dashboard.runFullAnalysis().catch(console.error);
}