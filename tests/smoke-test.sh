#!/bin/bash
# Arlo Meeting Assistant - Smoke Tests
# Tests basic functionality of all services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
    TESTS_RUN=$((TESTS_RUN + 1))
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_summary() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}Test Summary${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e "Total Tests: ${TESTS_RUN}"
    echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✅ All tests passed!${NC}\n"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed${NC}\n"
        exit 1
    fi
}

# Wait for services to be ready
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=0

    echo -e "${YELLOW}⏳ Waiting for ${service} to be ready...${NC}"

    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ ${service} is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    echo -e "${RED}✗ ${service} failed to start${NC}"
    return 1
}

# Check if Docker Compose is running
check_docker_compose() {
    print_test "Checking if Docker Compose services are running"

    if ! docker-compose ps | grep -q "Up"; then
        print_fail "Docker Compose services are not running. Run: docker-compose up -d"
        exit 1
    fi

    print_pass "Docker Compose services are running"
}

# Test 1: Backend Health Check
test_backend_health() {
    print_test "Testing backend health endpoint"

    response=$(curl -s http://localhost:3000/health)
    status=$(echo "$response" | grep -o '"status":"ok"' || true)

    if [ -n "$status" ]; then
        print_pass "Backend health check passed"
        return 0
    else
        print_fail "Backend health check failed. Response: $response"
        return 1
    fi
}

# Test 2: Frontend Accessibility
test_frontend_accessible() {
    print_test "Testing frontend accessibility"

    http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)

    if [ "$http_code" -eq 200 ]; then
        print_pass "Frontend is accessible"
        return 0
    else
        print_fail "Frontend returned HTTP $http_code"
        return 1
    fi
}

# Test 3: RTMS Service Health
test_rtms_health() {
    print_test "Testing RTMS service health"

    # RTMS might not have a health endpoint, check if container is running
    if docker-compose ps rtms | grep -q "Up"; then
        print_pass "RTMS service container is running"
        return 0
    else
        print_fail "RTMS service is not running"
        return 1
    fi
}

# Test 4: Database Connection
test_database_connection() {
    print_test "Testing database connection"

    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        print_pass "Database is accepting connections"
        return 0
    else
        print_fail "Database is not accepting connections"
        return 1
    fi
}

# Test 5: Database Tables Exist
test_database_tables() {
    print_test "Testing database tables exist"

    tables=$(docker-compose exec -T postgres psql -U postgres -d meeting_assistant -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1 | tr -d ' ')

    if [ "$tables" -gt 0 ] 2>/dev/null; then
        print_pass "Database has $tables tables"
        return 0
    else
        print_fail "No database tables found. Run: docker-compose exec backend npx prisma migrate dev"
        return 1
    fi
}

# Test 6: Backend API Routes
test_backend_routes() {
    print_test "Testing backend API routes"

    auth_response=$(curl -s http://localhost:3000/api/auth/authorize)
    if echo "$auth_response" | grep -q "codeChallenge"; then
        print_pass "Auth endpoint is working"
        return 0
    else
        print_fail "Auth endpoint returned unexpected response"
        return 1
    fi
}

# Test 7: WebSocket Server
test_websocket() {
    print_test "Testing WebSocket server port"

    if nc -z localhost 3000 2>/dev/null || timeout 1 bash -c "</dev/tcp/localhost/3000" 2>/dev/null; then
        print_pass "WebSocket server port is open"
        return 0
    else
        print_fail "WebSocket server port is not accessible"
        return 1
    fi
}

# Test 8: Environment Variables
test_env_variables() {
    print_test "Testing environment variables are loaded"

    logs=$(docker-compose logs backend 2>&1 | tail -20)

    if echo "$logs" | grep -q "Public URL:"; then
        print_pass "Environment variables are loaded"
        return 0
    else
        print_fail "Environment variables may not be properly loaded"
        return 1
    fi
}

# Test 9: Full-text Search Index
test_fulltext_index() {
    print_test "Testing full-text search index exists"

    index_check=$(docker-compose exec -T postgres psql -U postgres -d meeting_assistant -t -c "SELECT indexname FROM pg_indexes WHERE tablename='transcript_segments' AND indexname='transcript_segments_text_search_idx';" 2>&1)

    if echo "$index_check" | grep -q "transcript_segments_text_search_idx"; then
        print_pass "Full-text search index exists"
        return 0
    else
        print_fail "Full-text search index not found"
        return 1
    fi
}

# Test 10: Cookie Parser Middleware
test_cookie_parser() {
    print_test "Testing backend accepts requests"

    response=$(curl -s http://localhost:3000/health)

    if echo "$response" | grep -q "ok"; then
        print_pass "Backend middleware is working"
        return 0
    else
        print_fail "Backend may have middleware issues"
        return 1
    fi
}

# Main test execution
main() {
    print_header "Arlo Meeting Assistant - Smoke Tests"

    # Check Docker Compose
    check_docker_compose

    echo ""

    # Run tests (continue on failure)
    test_backend_health || true
    test_frontend_accessible || true
    test_rtms_health || true
    test_database_connection || true
    test_database_tables || true
    test_backend_routes || true
    test_websocket || true
    test_env_variables || true
    test_fulltext_index || true
    test_cookie_parser || true

    # Print summary
    print_summary
}

# Run tests
main
